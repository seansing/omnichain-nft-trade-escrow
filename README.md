# Testing Omnichain NFT Trade Escrow (with Hardhat Tasks)

## Introduction

Layer Zero's OApps (Omnichain Apps) allow us to send messages between contracts on different chains. By having the Smart Wallet contracts inherits the OApp, it allows the Smart Wallet contracts deployed on different chains to update each other's states via messages. Below is a diagram of how the Smart Wallet contracts work.

![Alt text](../layerZeroSmartWallet.png)

At the time of writing, 
- There is currently not support for testing LayerZero contracts with 2 different chains.
- LayerZero's mocks only differentiates the source and destination contracts via mock endpoint ids. The contracts themselves are all deployed on the same Hardhat chain.
- As the goal is to have the same smart wallet contract addresses deployed on various EVM chains using `create2`, it is not possible to replicate this implementation when testing on a single Hardhat chain. 

Hence, this README walks through an example of how the contracts can be tested on testnets.

## Testing steps
For this example, we will deploy SmartWalletFactory contracts on the Fuji testnet to Amoy testnet. SmartWalletFactory contracts inherits the OApp contract based on the Layer Zero's (LZ) V2 implementation [here](https://docs.layerzero.network/v2/developers/evm/oapp/overview).

Both contracts will be similar so that we would be able to send and receive messages between them (ie. they both have the same LZ sending and receiving implementations).

Start by cloning the repo and installing the dependencies.

```sh
git clone https://github.com/SnickerdoodleLabs/protocol.git
cd protocol
yarn 
cd packages/contracts
```
1. Make necessary `.env` updates with the private key of the signing account and fund the accounts with Fuji AVAX and Amoy MATIC tokens.
2. Set the correct the LZ endpoint address and owner params before each contract deployments in the [SmartWalletFactory.ts](/ignition/modules/SmartWalletFactory.ts#L6) file. The list of endpoint values can be found [here](https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts).

3. Deploy sample NFT contracts to Fuji and Amoy testnet and mint one NFT: 
    ```shell
   npx hardhat ignition deploy ignition/modules/ETHGlobalSGNFT.ts --network fuji --reset
   ```
   Expected output:
   ```shell
   Deployed Addresses

    ETHGlobalSGNFT#ETHGlobalSGNFT - 0x2196d3212aA8779b0011893DdB187BD86392A5f5
   ```

    ```shell
   npx hardhat mintNFT --nftaddress 0x2196d3212aA8779b0011893DdB187BD86392A5f5 --to 0xBaea3282Cd6d44672EA12Eb6434ED1d1d4b615C7 --network fuji
   ```
   Expected output:
   ```shell
   NFT minted!
   ```

   Confirm the owner of the minted NFT
   ```shell
   npx hardhat ownerOf --nftaddress 0x2196d3212aA8779b0011893DdB187BD86392A5f5 --tokenid 0 --network fuji
   ```
   Expected output:
   ```shell
   Owner of token id:  0xBaea3282Cd6d44672EA12Eb6434ED1d1d4b615C7
   ```

   Here, change the mnemonic to another wallet in .env to mimic using another wallet on a different chain and repeat the steps on Amoy testnet. 


   ```shell
   npx hardhat ignition deploy ignition/modules/ETHGlobalSGNFT.ts --network amoy --reset
   ```
   Expected output:
   ```shell
   Deployed Addresses

    ETHGlobalSGNFT#ETHGlobalSGNFT - 0x7a6cAf93bca4aB444F71CB99f286C6D46F71f002
   ```
   
   ```shell
   npx hardhat mintNFT --nftaddress 0x7a6cAf93bca4aB444F71CB99f286C6D46F71f002 --to 0x074515de163625Dc67f44a63B623FB65a652dA94 --network amoy
   ```
   Expected output:
   ```shell
   NFT minted!
   ```

   Confirm the owner of the minted NFT
   ```shell
   npx hardhat ownerOf --nftaddress 0x7a6cAf93bca4aB444F71CB99f286C6D46F71f002 --tokenid 1 --network amoy
   ```
   Expected output:
   ```shell
   Owner of token id:  0x074515de163625Dc67f44a63B623FB65a652dA94
   ```

4. Once the NFts are setup, deploy the NFTTradeEscrow contracts to Fuji and Amoy testnets:
   ```shell
   npx hardhat ignition deploy ignition/modules/NFTTradeEscrow.ts --network fuji --reset
   ```

   Expected output:
   ```shell
   Deployed Addresses

    NFTTradeEscrowModule#NFTTradeEscrow - 0x545975e0D6fd8dD76b68a75F1EF2425e9677F70A
   ```

    ```shell
    npx hardhat ignition deploy ignition/modules/NFTTradeEscrow.ts --network amoy --reset
    ```

   Expected output:
   ```shell
   Deployed Addresses

   NFTTradeEscrowModule#NFTTradeEscrow - 0xAdF548BE1E0421c85cb8Cd6b83107F2f730373bf
   ```

5. We then need to call `setPeer` to connect the contracts together. The list of endpoint values can be found [here](https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts). We need to do this step for all destination chain ids we want to connect.

   The respective peer contract addresses are the contract addresses deployed above.

    - Amoy's endpoint id is `40267`
    - Fuji's endpoint id is `40106`

   Call `setPeer` on the Fuji contract to point to the Amoy contract:
   ```shell
   npx hardhat nftTradeEscrowSetPeer --currentcontract 0x545975e0D6fd8dD76b68a75F1EF2425e9677F70A --peercontract 0xAdF548BE1E0421c85cb8Cd6b83107F2f730373bf --eid 40267 --network fuji
   ```
   Call `setPeer` on the Amoy contract to point to the Fuji contract:

   ```shell
   npx hardhat nftTradeEscrowSetPeer --currentcontract 0xAdF548BE1E0421c85cb8Cd6b83107F2f730373bf --peercontract 0x545975e0D6fd8dD76b68a75F1EF2425e9677F70A --eid 40106 --network amoy
   ```
   
6. Try deploying a smart wallet on the destination chain. We expect to see an error that says it has not deployed the wallet on the source chain.
    ``` shell
    npx hardhat deploySmartWalletUpgradeableBeacon --name MYSMARTWALLET --owner 0xBaea3282Cd6d44672EA12Eb6434ED1d1d4b615C7 --network amoy
    ```
   Expected output:

    ``` shell
    ...ProviderError: execution reverted: SmartWalletFactory: Smart wallet with selected name has not been created on the source chain
    ```

7. Deploy a smart wallet on the source chain. 
    ``` shell
    npx hardhat deploySmartWalletUpgradeableBeacon --name MYSMARTWALLET --owner 0xBaea3282Cd6d44672EA12Eb6434ED1d1d4b615C7 --network fuji
    ```
    Expected output:

    ``` shell
    Smart wallet deployed!
    ```

8.  Compute the smart wallet proxy address for a given name.
    ``` shell
	npx hardhat computeSmartWalletProxyAddress --name MYSMARTWALLET --network fuji
	```
    Expected output:

    ``` shell
	Proxy Address: 0x622DC353688ae8168400A2De185fE8808474872E
	```
9.  We can confirm that the owner matches the deployed and computed proxy address.

    ``` shell
    npx hardhat getOwnerOfSmartWallet --smartwalletaddress 0x622DC353688ae8168400A2De185fE8808474872E --network fuji
    ```
    Expected output:

    ``` shell
    Owner address: 0xBaea3282Cd6d44672EA12Eb6434ED1d1d4b615C7
	```

10. Before claiming the wallet on the destination chain, we get a quote of the fees to send that message from our source chain.
    ``` shell
    npx hardhat quoteClaimSmartWalletOnDestinationChain --destinationchainid 40267 --owner 0xBaea3282Cd6d44672EA12Eb6434ED1d1d4b615C7 --smartwalletaddress 0x622DC353688ae8168400A2De185fE8808474872E --network fuji
    ```
    Expected output:

    ``` shell
    Quoted price: [ 9137755207124937n, 0n ]
	```

11. Now, we initiate a layer zero call from the source to the destination chain to claim the wallet on the destination chain. Using the quote above as the fee in wei. If the transaction is successful, Layer Zero will also send a message to the destination chain to update the owner of the smart wallet address.
    
    If the user tried with a wallet name that has not been deployed against the owner address, it will error out.
    ``` shell
    npx hardhat claimSmartWalletAddressOnDestinationChain --destinationchaineid 40267 --walletname WRONGWALLETNAME --owner 0xBaea3282Cd6d44672EA12Eb6434ED1d1d4b615C7 --feeinwei 9137755207124937 --network fuji
    ```
    Expected output:

    ``` shell
    ...ProviderError: execution reverted: SmartWalletFactory: Owner provided has not deployed wallet with provided name
	```
    Trying again with the correct wallet name...
    ``` shell
    npx hardhat claimSmartWalletAddressOnDestinationChain --destinationchaineid 40267 --walletname MYSMARTWALLET --owner 0xBaea3282Cd6d44672EA12Eb6434ED1d1d4b615C7 --feeinwei 9137755207124937 --network fuji
    ```
    Expected output:

    ``` shell
    Wallet claimed request submitted to destination chain! Txhash: 0x1bc38650c0a04e2fd49fbd85ba37e9f868e25f256f9a2c6240c5f2e68061fe83
	```

12. Using the transaction hash, check the status of the message sent to LZ (and ultimately to the contract on Mumbai) via the scanner like [this](https://testnet.layerzeroscan.com/tx/0x1bc38650c0a04e2fd49fbd85ba37e9f868e25f256f9a2c6240c5f2e68061fe83). This process took about 2 minutes to reach the complete status.
13. Repeat the smart wallet ownership check on the source and destination chains to confirm that Layer Zero has updated the destination chain's status.

	``` shell
    npx hardhat getOwnerOfSmartWallet --smartwalletaddress 0x622DC353688ae8168400A2De185fE8808474872E --network fuji
    ```

    Expected output: 
    
    ``` shell
    Owner address: 0xBaea3282Cd6d44672EA12Eb6434ED1d1d4b615C7
    ```
    
    Running this command gets the owner of the smart wallet address on the Amoy contract.
    ``` shell
    npx hardhat getOwnerOfSmartWallet --smartwalletaddress 0x622DC353688ae8168400A2De185fE8808474872E --network amoy
    ```
    Expected output: 
    
    ``` shell
    Owner address: 0xBaea3282Cd6d44672EA12Eb6434ED1d1d4b615C7
    ```

14. Finally, we can now create a smart wallet on the destination chain.

    ``` shell
    npx hardhat deploySmartWalletUpgradeableBeacon --name MYSMARTWALLET --owner 0xBaea3282Cd6d44672EA12Eb6434ED1d1d4b615C7 --network amoy
    ```
    Expected output:
    
     ``` shell
     Smart wallet deployed!
     ```
15. Optional : We can also use the event checker script to confirm the deployed proxy address. Setup the correct params like block number (using the output from the step 7) to target the correct SmartWalletCreated event
   ``` shell
   npx hardhat run scripts/getPastEvents.ts  
   ```
   
   Expected output:
   ``` shell
    Fetching events from block 11028897 to 11028997...
    Found 1 event(s):
    Event 1:
        Smart Wallet Address: 0x622DC353688ae8168400A2De185fE8808474872E
        Block Number: 11028997
        Transaction Hash: 0x988bc3cbbb305b7e026585f72f6af30f095f7443a13b58b9175b9586018d839e
        Log Index: undefined
   ```
    
