import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const NFTTradeEscrowModule = buildModule("NFTTradeEscrowModule", (m) => {
  const owner = "0xBaea3282Cd6d44672EA12Eb6434ED1d1d4b615C7";

  // Change the params here based on the chain to deploy on
  const nftTradeEscrow = m.contract("NFTTradeEscrow", [
    "0x6EDCE65403992e310A62460808c4b910D972f10f", //Testnet deployment of layer zero endpoint
    owner,
  ]);

  return { nftTradeEscrow };
});

export default NFTTradeEscrowModule;
