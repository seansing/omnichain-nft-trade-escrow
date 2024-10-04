import {
    time,
    loadFixture,
  } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
  import { expect } from "chai";
  import hre from "hardhat";
  import { pad } from "viem";

  
  describe("NFTTradeEscrow", function () {

    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployContracts() {

      const [owner, otherAccount1, otherAccount2] = await hre.viem.getWalletClients();

      const publicClient = await hre.viem.getPublicClient();

      // Represents the LZ endpoint id for Chain 1 (source chain)
      const eid1 = 1;
      // Represents the LZ endpoint id for Chain 2 (destination chain)
      const eid2 = 2;
      const eid3 = 3;

      // Represents LZ endpoint contract on Chain 1 (source chain)
      const mockLZEndpoint1 = await hre.viem.deployContract("EndpointV2Mock", [eid1]);
      // Represents LZ endpoint contract on Chain 2 (destination chain)
      const mockLZEndpoint2 = await hre.viem.deployContract("EndpointV2Mock", [eid2]);

      // Represents NFTTradeEscrow deployed on Chain 1
      const nftTradeEscrow1 = await hre.viem.deployContract("NFTTradeEscrow", [mockLZEndpoint1.address, owner.account.address]);
      // Represents NFTTradeEscrow deployed on Chain 2
      const nftTradeEscrow2 = await hre.viem.deployContract("NFTTradeEscrow", [mockLZEndpoint2.address, owner.account.address]);
        
      // Setting destination endpoints in the LZEndpoint mock for each NFTTradeEscrow instance
      await mockLZEndpoint1.write.setDestLzEndpoint([nftTradeEscrow2.address, mockLZEndpoint2.address])
      await mockLZEndpoint2.write.setDestLzEndpoint([nftTradeEscrow1.address, mockLZEndpoint1.address])

      // Set peers so that they are connected to each other
      await nftTradeEscrow1.write.setPeer([eid2, pad(nftTradeEscrow2.address) as `0x${string}`]);
      await nftTradeEscrow2.write.setPeer([eid1, pad(nftTradeEscrow1.address) as `0x${string}`]);

      // Represents NFT contract deployed on Chain 1
      const nft1 = await hre.viem.deployContract("ETHGlobalSGNFT");
      // Represents NFT deployed contract on Chain 2
      const nft2 = await hre.viem.deployContract("ETHGlobalSGNFT");

      // Mint 1 nft to account1 on Chain 1 and 2 nfts to account2 on Chain 2
      await nft1.write.safeMint([otherAccount1.account.address]);
      await nft2.write.safeMint([otherAccount2.account.address]);
      await nft2.write.safeMint([otherAccount2.account.address]);

      // Approve the NFTs to be transferred by the NFTTradeEscrow contracts on their behalf
      await nft1.write.approve([nftTradeEscrow1.address, 0n], { account: otherAccount1.account });
      await nft2.write.approve([nftTradeEscrow2.address, 1n], { account: otherAccount2.account });

      return {
        owner,
        otherAccount1,
        otherAccount2,
        publicClient,
        mockLZEndpoint1,
        mockLZEndpoint2,
        nftTradeEscrow1,
        nftTradeEscrow2,
        eid1,
        eid2,
        nft1,
        nft2,
      };
    }

    describe("Use case flow test", function () {
        it("should complete the trade between User1 and User2", async function () {
          const {
            owner,
            otherAccount1,
            otherAccount2,
            eid1,
            eid2,
            nftTradeEscrow1,
            nftTradeEscrow2,
            nft1,
            nft2,
            publicClient,
          } = await loadFixture(deployContracts);
      
          // Step 1: Calculate the fee for `interestToTrade`
          const [nativeFee1, lzTokenFee1] = await nftTradeEscrow1.read.quoteInterestToTrade([
            eid2, // Destination chain
            nft1.address, // NFT to trade (on chain 1)
            0n, // Token ID to trade (User1's token on chain 1)
            nft2.address, // Desired NFT on chain 2
            1n, // Desired token ID (User2's token on chain 2)
            "0x0003010011010000000000000000000000000000ea60", // assuming 200k gas for function call
          ]);
      
          // Step 1: User 1 Calls `interestToTrade` on Chain 1 for token 0 of `nft1` to trade for token 1 of `nft2`
          await nftTradeEscrow1.write.interestToTrade(
            [
              eid2, // Destination chain
              nft1.address, // NFT to trade (on chain 1)
              0n, // Token ID to trade (User1's token on chain 1)
              nft2.address, // Desired NFT on chain 2
              1n, // Desired token ID (User2's token on chain 2)
              300000n // Gas limit for sending the transaction
            ],
            { account: otherAccount1.account, value: nativeFee1 * 4n } // Value sent for fees, calculated for this transaction
          );

          const trade1 = await nftTradeEscrow1.read.trades([otherAccount1.account.address]);

          // Step 2: Calculate the fee for `lockInInterest`
          const [nativeFee2, lzTokenFe2] = await nftTradeEscrow2.read.quoteReadyToTrade([
            eid1, // Source chain (User1’s chain)
            nft2.address, // NFT to lock in (on chain 2)
            1n, // Token ID of the NFT to lock in
            otherAccount1.account.address, // User 1 (on chain 1) who initiated the trade
            "0x0003010011010000000000000000000000000000ea60", // assuming 200k gas for function call
          ]);
          
          // Step 2: User 2 Calls `lockInInterest` on Chain 2 for token 1 of `nft2`
          await nftTradeEscrow2.write.lockInInterest(
            [
              eid1, // Source chain (User1’s chain)
              nft2.address, // NFT to lock in (on chain 2)
              1n, // Token ID of the NFT to lock in
              otherAccount1.account.address, // User 1 (on chain 1) who initiated the trade
              300000n // Gas limit for sending the transaction
            ],
            { account: otherAccount2.account, value: nativeFee2 * 3n } // Value sent for fees, calculated for this transaction
          );

          const trade1after = await nftTradeEscrow1.read.trades([otherAccount1.account.address]);
          const trade1after2 = await nftTradeEscrow2.read.trades([otherAccount1.account.address]);

          console.log("Interest locked in");
      
          // Step 3: Calculate the fee for `fulfillTrade`
          const [nativeFee3, lzTokenFe3] = await nftTradeEscrow1.read.quoteTradeFulfilled([
            eid2, // Target chain
            otherAccount1.account.address, // User 1 (initiator)
            otherAccount2.account.address, // User 2 (counterparty)
            "0x0003010011010000000000000000000000000000ea60", // assuming 200k gas for function call
          ]);
      
          // Step 3: User 1 Calls `fulfillTrade` on Chain 1 to finalize the trade
          await nftTradeEscrow1.write.fulfillTrade(
            [eid2, 300000n], // Target chain and gas limit
            { account: otherAccount1.account, value: nativeFee3 * 3n } // Value sent for fees, calculated for this transaction
          );

          console.log("Trade fulfilled");
      
          // Step 4: Validate ownership after the trade
          const ownerOfNFT1Token0 = await publicClient.readContract({
            address: nft1.address,
            abi: nft1.abi,
            functionName: "ownerOf",
            args: [0n], // Check owner of token 0 of nft1
          });
      
          const ownerOfNFT2Token1 = await publicClient.readContract({
            address: nft2.address,
            abi: nft2.abi,
            functionName: "ownerOf",
            args: [1n], // Check owner of token 1 of nft2
          });
      
          // Check if User2 is the new owner of NFT1's token 0
          expect(ownerOfNFT1Token0.toLowerCase()).to.equal(otherAccount2.account.address);
      
          // Check if User1 is the new owner of NFT2's token 1
          expect(ownerOfNFT2Token1.toLowerCase()).to.equal(otherAccount1.account.address);
        });
      });      

  });
  