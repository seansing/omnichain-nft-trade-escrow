import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const NFTModule = buildModule("ETHGlobalSGNFT", (m) => {
  
  // Change the params here based on the chain to deploy on
  const nft = m.contract("ETHGlobalSGNFT");

  return { nft };
});

export default NFTModule;
