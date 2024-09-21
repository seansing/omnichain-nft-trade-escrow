// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import { OApp, Origin, MessagingFee } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import { OptionsBuilder } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTTradeEscrow is OApp {
    using OptionsBuilder for bytes;

    enum MessageType {
        InterestToTrade,
        LockInInterest,
        ReadyToTrade,
        TradeFulfilled
    }

    struct Trade {
        address user1;
        address user2;
        address nft1;
        uint256 tokenId1;
        address nft2;
        uint256 tokenId2;
        bool isLockedIn;
        bool isFulfilled;
    }

    mapping(address => Trade) public trades;

    event TradeInterestInitiated(address indexed user1, address indexed nft1, uint256 tokenId1, address nftDesired, uint256 tokenIdDesired);
    event TradeLockedIn(address indexed user2, address indexed nft2, uint256 tokenId2);
    event TradeReadyToFulfill(address indexed user1, address indexed user2);
    event TradeFulfilled(address indexed user1, address indexed user2);

    constructor(address _layerZeroEndpoint, address _owner) OApp(_layerZeroEndpoint, _owner) Ownable(_owner) {}

    function interestToTrade(
        uint32 _destinationChainEID,
        address _nftForTrade,
        uint256 _tokenIdForTrade,
        address _nftDesired,
        uint256 _tokenIdDesired,
        uint128 _gas
    ) public payable {
        IERC721(_nftForTrade).transferFrom(msg.sender, address(this), _tokenIdForTrade);

        trades[msg.sender] = Trade(msg.sender, address(0), _nftForTrade, _tokenIdForTrade, _nftDesired, _tokenIdDesired, false, false);

        bytes memory _payload = abi.encode(
            uint8(MessageType.InterestToTrade), 
            msg.sender, 
            _nftForTrade, 
            _tokenIdForTrade, 
            _nftDesired, 
            _tokenIdDesired
        );

        _lzSend(
            _destinationChainEID,
            _payload,
            OptionsBuilder.newOptions().addExecutorLzReceiveOption(_gas, 0),
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );

        emit TradeInterestInitiated(msg.sender, _nftForTrade, _tokenIdForTrade, _nftDesired, _tokenIdDesired);
    }

    function lockInInterest(
        uint32 _sourceChainEID,
        address _nft2,
        uint256 _tokenId2,
        address _user1,
        uint128 _gas
    ) public payable {
        require(trades[_user1].user2 == address(0), "Trade already locked in");
        IERC721(_nft2).transferFrom(msg.sender, address(this), _tokenId2);
        trades[_user1].user2 = msg.sender;
        trades[_user1].nft2 = _nft2;
        trades[_user1].tokenId2 = _tokenId2;
        trades[_user1].isLockedIn = true;

        bytes memory _payload = abi.encode(
            uint8(MessageType.ReadyToTrade), 
            msg.sender, 
            _nft2, 
            _tokenId2, 
            _user1
        );

        _lzSend(
            _sourceChainEID,
            _payload,
            OptionsBuilder.newOptions().addExecutorLzReceiveOption(_gas, 0),
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );

        emit TradeLockedIn(msg.sender, _nft2, _tokenId2);
    }

    function fulfillTrade(uint32 _destinationChainEID, uint128 _gas) public payable {
        Trade storage trade = trades[msg.sender];
        require(trade.isLockedIn, "Trade is not locked in yet");
        require(!trade.isFulfilled, "Trade is already fulfilled");

        IERC721(trade.nft1).transferFrom(address(this), trade.user2, trade.tokenId1);

        bytes memory _payload = abi.encode(
            uint8(MessageType.TradeFulfilled), 
            msg.sender, 
            trade.user2
        );

        _lzSend(
            _destinationChainEID,
            _payload,
            OptionsBuilder.newOptions().addExecutorLzReceiveOption(_gas, 0),
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );

        trade.isFulfilled = true;

        emit TradeFulfilled(msg.sender, trade.user2);
    }

    function withdrawNFT(address _user) public {
        Trade storage trade = trades[_user];
        require(trade.isFulfilled, "Trade is not fulfilled yet");

        IERC721(trade.nft2).transferFrom(address(this), trade.user1, trade.tokenId2);

        delete trades[_user];
    }

    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _payload,
        address,
        bytes calldata
    ) internal override {
        (uint8 messageType, bytes memory messageData) = abi.decode(_payload, (uint8, bytes));

        if (messageType == uint8(MessageType.InterestToTrade)) {
            _handleInterestToTrade(messageData);
        } else if (messageType == uint8(MessageType.ReadyToTrade)) {
            _handleReadyToTrade(messageData);
        } else if (messageType == uint8(MessageType.TradeFulfilled)) {
            _handleTradeFulfilled(messageData);
        } else {
            revert("NFTTradeEscrow: Unknown message type");
        }
    }

    function _handleInterestToTrade(bytes memory messageData) internal {
        (address user1, address nft1, uint256 tokenId1, address nftDesired, uint256 tokenIdDesired) = abi.decode(messageData, (address, address, uint256, address, uint256));
        trades[user1] = Trade(user1, address(0), nft1, tokenId1, nftDesired, tokenIdDesired, false, false);
        emit TradeInterestInitiated(user1, nft1, tokenId1, nftDesired, tokenIdDesired);
    }

    function _handleReadyToTrade(bytes memory messageData) internal {
        (address user2, address nft2, uint256 tokenId2, address user1) = abi.decode(messageData, (address, address, uint256, address));
        trades[user1].user2 = user2;
        trades[user1].nft2 = nft2;
        trades[user1].tokenId2 = tokenId2;
        trades[user1].isLockedIn = true;
        emit TradeLockedIn(user2, nft2, tokenId2);
    }

    function _handleTradeFulfilled(bytes memory messageData) internal {
        (address user1, address user2) = abi.decode(messageData, (address, address));
        trades[user1].isFulfilled = true;

        // Transfer the destination chain's token to the owner
        IERC721(trades[user1].nft2).transferFrom(address(this), trades[user1].user1, trades[user1].tokenId2);
        emit TradeFulfilled(user1, user2);
    }

    // Gas quote for InterestToTrade
    function quoteInterestToTrade(
        uint32 _dstEid, 
        address _owner, 
        address _nftForTrade, 
        uint256 _tokenIdForTrade, 
        address _nftDesired, 
        uint256 _tokenIdDesired, 
        bytes calldata _options
    ) external view returns (uint256 nativeFee, uint256 lzTokenFee) {
        bytes memory messageData = abi.encode(_owner, _nftForTrade, _tokenIdForTrade, _nftDesired, _tokenIdDesired);
        return quote(_dstEid, uint8(MessageType.InterestToTrade), messageData, _options, false);
    }

    // Gas quote for LockInInterest
    function quoteLockInInterest(
        uint32 _dstEid, 
        address _nft2, 
        uint256 _tokenId2, 
        address _user1, 
        bytes calldata _options
    ) external view returns (uint256 nativeFee, uint256 lzTokenFee) {
        bytes memory messageData = abi.encode(_nft2, _tokenId2, _user1);
        return quote(_dstEid, uint8(MessageType.ReadyToTrade), messageData, _options, false);
    }

    // Gas quote for TradeFulfilled
    function quoteTradeFulfilled(
        uint32 _dstEid, 
        address _user1, 
        address _user2, 
        bytes calldata _options
    ) external view returns (uint256 nativeFee, uint256 lzTokenFee) {
        bytes memory messageData = abi.encode(_user1, _user2);
        return quote(_dstEid, uint8(MessageType.TradeFulfilled), messageData, _options, false);
    }

    /// @dev Quotes the gas needed to pay for the full omnichain transaction.
    /// @param _dstEid Destination chain's endpoint ID.
    /// @param _messageType Message type
    /// @param _messageData Smart wallet address
    /// @param _options Message execution options (e.g., for sending gas to destination).
    /// @param _payInLzToken To pay in LZ token or not
    /// @return nativeFee Estimated gas fee in native gas.
    /// @return lzTokenFee Estimated gas fee in ZRO token.
    function quote(
        uint32 _dstEid, 
        uint8 _messageType, 
        bytes memory _messageData, 
        bytes calldata _options, 
        bool _payInLzToken 
    ) internal view returns (uint256 nativeFee, uint256 lzTokenFee) {
        // Prepare the message payload based on the message type
        bytes memory _payload = abi.encode(_messageType, _messageData);

        // Get the estimated fees
        MessagingFee memory fee = _quote(_dstEid, _payload, _options, _payInLzToken);
        return (fee.nativeFee, fee.lzTokenFee);
    }
}
