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
      const mockLZEndpoint3 = await hre.viem.deployContract("EndpointV2Mock", [eid3]);

      // Represents NFTTradeEscrow deployed on Chain 1
      const nftTradeEscrow1 = await hre.viem.deployContract("NFTTradeEscrow", [mockLZEndpoint1.address, owner.account.address]);
      // Represents NFTTradeEscrow deployed on Chain 2
      const nftTradeEscrow2 = await hre.viem.deployContract("NFTTradeEscrow", [mockLZEndpoint2.address, owner.account.address]);
        
      // Setting destination endpoints in the LZEndpoint mock for each MyOApp instance
      await mockLZEndpoint1.write.setDestLzEndpoint([nftTradeEscrow2.address, mockLZEndpoint2.address])
      await mockLZEndpoint2.write.setDestLzEndpoint([nftTradeEscrow1.address, mockLZEndpoint1.address])

      // Set peers so that they are connected to each other
      await nftTradeEscrow1.write.setPeer([eid2, pad(nftTradeEscrow2.address) as `0x${string}`]);
      await nftTradeEscrow2.write.setPeer([eid1, pad(nftTradeEscrow1.address) as `0x${string}`]);

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
        eid3
      };
    }
  
    describe("Use case flow test", function () {
        it("", async function () {
          const { owner, otherAccount1, otherAccount2, eid1, eid2, eid3, nftTradeEscrow1, nftTradeEscrow2 } = await loadFixture(deployContracts);

        });
      });
  });
  