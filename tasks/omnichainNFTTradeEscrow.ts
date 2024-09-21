import { task } from "hardhat/config";
import { keccak256 } from "viem";

const NFT_TRADE_ESCROW_CONTRACT_SOURCE_CHAIN = "0x21F1dfE03B5157B4A77d162337d82a936aCD05D8";
const NFT_TRADE_ESCROW_CONTRACT_DESTINATION_CHAIN = "";

const SAMPLE_NFT_SOURCE_CHAIN = "0x19F118F5bd9aF69c8409647f3683530d5229d802";
const SAMPLE_NFT_DESTINATION_CHAIN = "";

task(
    "mintNFT",
    "Mints an NFT",
)
.addParam("nftaddress", "Address of the NFT contract")
.addParam("to", "Recipient address")
.setAction(async (taskArgs) => {

    const factory = await hre.viem.getContractAt(
      "ETHGlobalSGNFT",
      taskArgs.nftaddress,
    );
    const hash = await factory.write.safeMint([taskArgs.to]);

    const publicClient = await hre.viem.getPublicClient();
    const txReceipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log("NFT minted!");
});

task(
    "ownerOf",
    "Check of of token id",
)
.addParam("nftaddress", "Address of the NFT contract")
.addParam("tokenid", "Token id to check")
.setAction(async (taskArgs) => {

    const factory = await hre.viem.getContractAt(
      "ETHGlobalSGNFT",
      taskArgs.nftaddress,
    );
    const owner = await factory.read.ownerOf([taskArgs.tokenid]);

    console.log("Owner of token id: ", owner);

});

task(
    "approveTransfer",
    "Approve token transfer for given token id",
)
.addParam("nftaddress", "Address of the NFT contract")
.addParam("tokenid", "Token id to approve transfer for")
.setAction(async (taskArgs) => {

    const factory = await hre.viem.getContractAt(
        "ETHGlobalSGNFT",
        taskArgs.nftaddress,
      );
      const hash = await factory.write.approve([taskArgs.nftaddress, taskArgs.tokenid]);
  
      const publicClient = await hre.viem.getPublicClient();
      const txReceipt = await publicClient.waitForTransactionReceipt({ hash });
  
      console.log("Approved!");

});


task(
  "nftTradeEscrowSetPeer",
  "Hooks up NFT Trade Escrow contracts on the target chains together",
)
  .addParam("eid", "Layer Zero endpoint id for target chain")
  .addParam(
    "peercontract",
    "The NFT Trade Escrow contract on the target chain",
  )
  .addParam(
    "currentcontract",
    "The NFT Trade Escrow contract on the current chain",
  )
  .setAction(async (taskArgs) => {
    const eid = taskArgs.eid;
    let peerContract = taskArgs.peercontract;

    // Format it to bytes32
    const padding = "0x000000000000000000000000";
    peerContract = padding.concat(peerContract.substring(2));
    const publicClient = await hre.viem.getPublicClient();
    const factory = await hre.viem.getContractAt(
      "NFTTradeEscrow",
      NFT_TRADE_ESCROW_CONTRACT_SOURCE_CHAIN,
    );
    const hash = await factory.write.setPeer([eid, peerContract]);
    const txReceipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log("Set peer successful!");
  });
  
task(
    "quoteInterestToTrade",
    "Get price to send an interest to trade message",
)
.addParam("eid", "Layer Zero endpoint id for target chain")
.addParam(
  "currentcontract",
  "The NFT Trade Escrow contract on the current chain",
)
.addParam("tokenowner", "Token owner")
.addParam("tokenid", "Token id to trade")
.addParam("nftaddress", "NFT's address")
.addParam("tokeniddesired", "Token id desired")
.addParam("nftaddressdesired", "Address of nft desired")
.setAction(async (taskArgs) => {

    const factory = await hre.viem.getContractAt(
      "ETHGlobalSGNFT",
      taskArgs.nftaddress,
    );
    const owner = await factory.read.quoteInterestToTrade([taskArgs.eid, taskArgs.nftaddress, taskArgs.tokenid, taskArgs.nftaddressdesired, taskArgs.tokeniddesired, "0x0003010011010000000000000000000000000000ea60"]);

    console.log("Owner of token id: ", owner);
});

  task(
    "interestToTrade",
    "Initiates an interest to trade on the NFT Trade Escrow contract",
  )
    .addParam("eid", "Layer Zero endpoint id for target chain")
    .addParam(
      "currentcontract",
      "The NFT Trade Escrow contract on the current chain",
    )
    .addParam("tokenid", "Token id to trade")
    .addParam("nftaddress", "NFT's address")
    .addParam("tokeniddesired", "Token id desired")
    .addParam("nftaddressdesired", "Address of nft desired")
    .addParam("gasinwei", "Gas in wei for message sending")
    .setAction(async (taskArgs) => {
      const eid = taskArgs.eid;
      let peerContract = taskArgs.peercontract;
  
      // Format it to bytes32
      const padding = "0x000000000000000000000000";
      peerContract = padding.concat(peerContract.substring(2));
      const publicClient = await hre.viem.getPublicClient();
      const factory = await hre.viem.getContractAt(
        "NFTTradeEscrow",
        taskArgs.currentcontract,
      );
      const hash = await factory.write.initiateTrade([taskArgs.eid, taskArgs.nftaddress, taskArgs.tokenid, taskArgs.nftaddressdesire, taskArgs.tokeniddesired, taskArgs.gasinwei]);
      const txReceipt = await publicClient.waitForTransactionReceipt({ hash });
  
      console.log("Set peer successful!");
    }); 

    task(
        "quoteReadyToTrade",
        "Get price to send an interest to trade message",
    )
    .addParam("eid", "Layer Zero endpoint id for target chain")
    .addParam(
      "currentcontract",
      "The NFT Trade Escrow contract on the current chain",
    )
    .addParam("tokenowner", "Token owner")
    .addParam("tokenid", "Token id to trade")
    .addParam("nftaddress", "NFT's address")
    .addParam("tokeniddesired", "Token id desired")
    .addParam("nftaddressdesired", "Address of nft desired")
    .setAction(async (taskArgs) => {
    
        const factory = await hre.viem.getContractAt(
          "ETHGlobalSGNFT",
          taskArgs.nftaddress,
        );
        const owner = await factory.read.quoteInterestToTrade([taskArgs.eid, taskArgs.nftaddress, taskArgs.tokenid, taskArgs.nftaddressdesired, taskArgs.tokeniddesired, "0x0003010011010000000000000000000000000000ea60"]);
    
        console.log("Owner of token id: ", owner);
    });


function padding(addressToPad) {
  // Format it to bytes32
  const padding = "0x000000000000000000000000";
  return padding.concat(addressToPad.substring(2));
}
