const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { expectRevert } = require("../utils/expectRevert");

const BASE = BigNumber.from(10).pow(18);
const zeroAddress = "0x0000000000000000000000000000000000000000";
describe("XVault", function () {
  it("Should run as expected", async function () {
    const checkBalances = async (alwaysPrint = false) => {
      let ownerBal = await xToken.balanceOf(initialOwner._address);
      let aliceBal = await xToken.balanceOf(alice._address);
      let bobBal = await xToken.balanceOf(bob._address);
      let carolBal = await xToken.balanceOf(carol._address);
      let vaultBal = await xToken.balanceOf(xVault.address);
      let supply = await xToken.totalSupply();
      let vaultNFTBal = await nft.balanceOf(xVault.address);

      const isCorrect =
        vaultBal.toString() === "0" &&
        ownerBal.add(aliceBal).add(bobBal).add(carolBal).toString() ===
          supply.toString() &&
        supply.div(BASE).toString() === vaultNFTBal.toString();

      if (!isCorrect) {
        console.log("\n-------------- ERROR -------------- \n");
      }
      if (alwaysPrint || !isCorrect) {
        console.log("ERC20 \n");
        console.log("  ", ownerBal.toString(), ": initialOwner");
        console.log("  ", aliceBal.toString(), ": alice");
        console.log("  ", bobBal.toString(), ": bob");
        console.log("  ", carolBal.toString(), ": carol");
        console.log("  ", vaultBal.toString(), ": xVault \n");
        console.log("  ", supply.toString(), ": totalSupply\n");
        console.log("ERC721 \n");
        console.log("  ", vaultNFTBal.toString(), ": xVault \n");
        return false;
      }
      return true;
    };

    // Initialize...

    const Erc721 = await ethers.getContractFactory("ERC721");
    const XToken = await ethers.getContractFactory("XToken");
    const XVault = await ethers.getContractFactory("XVault");

    const nft = await Erc721.deploy("Nft", "NFT");
    await nft.deployed();

    const xToken = await XToken.deploy("XToken", "XTO");
    await xToken.deployed();

    const xVault = await XVault.deploy(xToken.address, nft.address);
    await xVault.deployed();

    const [initialOwner, alice, bob, carol] = await ethers.getSigners();

    await xToken.connect(initialOwner).transferOwnership(xVault.address);

    const initialBalance = await xToken.balanceOf(initialOwner._address);
    await xToken.connect(initialOwner).transfer(xVault.address, initialBalance);

    // XVault: *.mintERC20 *.redeemERC20

    const approveAndMint = async (
      signer,
      tokenId,
      value = 0,
      tokenAlreadyExists = false
    ) => {
      if (!tokenAlreadyExists) {
        await nft.connect(signer).safeMint(signer._address, tokenId);
      }
      await nft.connect(signer).approve(xVault.address, tokenId);
      await xVault.connect(signer).mintERC20(tokenId, { value: value });
    };

    const approveAndRedeem = async (signer, value = 0) => {
      await xToken.connect(signer).approve(xVault.address, BASE);
      await xVault.connect(signer).redeemERC721({ value: value });
    };

    for (let i = 0; i < 10; i++) {
      await approveAndMint(alice, i);
      await approveAndMint(bob, 10 + i);
    }

    for (let i = 0; i < 10; i++) {
      await approveAndRedeem(alice);
      await approveAndRedeem(bob);
    }

    const getUserHoldings = async (address, tokenSupply) => {
      let list = [];
      for (let i = 0; i < 20; i++) {
        const nftOwner = await nft.ownerOf(i);
        if (nftOwner === address) {
          list.push(i);
        }
      }
      return list;
    };
    let aliceNFTs = await getUserHoldings(alice._address, 20);
    let bobNFTs = await getUserHoldings(bob._address, 20);

    console.log();
    console.log(aliceNFTs);
    console.log(bobNFTs);
    console.log();
    console.log("✓ XVault: mintERC20, redeemERC20");
    console.log();

    await checkBalances();

    // XVault: *.mintAndRedeem

    await expectRevert(xVault.connect(alice).mintAndRedeem(bobNFTs[0]));
    await expectRevert(xVault.connect(alice).mintAndRedeem(aliceNFTs[0]));
    await nft.connect(alice).approve(xVault.address, aliceNFTs[0]);
    await xVault.connect(alice).mintAndRedeem(aliceNFTs[0]);
    expect(await nft.ownerOf(aliceNFTs[0])).to.equal(alice._address);
    await nft.connect(bob).approve(xVault.address, bobNFTs[0]);
    await nft.connect(bob).approve(xVault.address, bobNFTs[1]);
    await xVault.connect(bob).mintERC20(bobNFTs[0]);
    await xVault.connect(bob).mintERC20(bobNFTs[1]);
    await nft.connect(alice).approve(xVault.address, aliceNFTs[0]);
    await xVault.connect(alice).mintAndRedeem(aliceNFTs[0]);
    const selections = [];
    for (let i = 0; i < 10; i++) {
      const newSelection =
        (await nft.ownerOf(bobNFTs[0])) == alice._address
          ? bobNFTs[0]
          : (await nft.ownerOf(bobNFTs[1])) == alice._address
          ? bobNFTs[1]
          : aliceNFTs[0];
      selections.push(newSelection);
      await nft.connect(alice).approve(xVault.address, newSelection);
      await xVault.connect(alice).mintAndRedeem(newSelection);
    }
    await xToken.connect(bob).approve(xVault.address, BASE.mul(2).toString());
    await xVault.connect(bob).redeemERC721();
    await xVault.connect(bob).redeemERC721();
    console.log(selections);
    console.log("✓ XVault: mintAndRedeem");
    console.log();

    await checkBalances();

    // XVault: *.mintERC20s, *.redeemERC721s

    aliceNFTs = await getUserHoldings(alice._address, 20);
    bobNFTs = await getUserHoldings(bob._address, 20);
    await nft.connect(alice).setApprovalForAll(xVault.address, true);
    await nft.connect(bob).setApprovalForAll(xVault.address, true);
    await xVault.connect(alice).mintERC20s(aliceNFTs.slice(0, 5));
    for (let i = 0; i < 5; i++) {
      expect(await nft.ownerOf(aliceNFTs[i])).to.equal(xVault.address);
    }
    for (let i = 5; i < 10; i++) {
      expect(await nft.ownerOf(aliceNFTs[i])).to.equal(alice._address);
    }
    const FIVE = BASE.mul(5).toString();
    expect((await xToken.balanceOf(alice._address)).toString()).to.equal(FIVE);
    await xToken.connect(alice).approve(xVault.address, FIVE);
    await xVault.connect(alice).redeemERC721s(5);
    for (let i = 0; i < 10; i++) {
      expect(await nft.ownerOf(aliceNFTs[i])).to.equal(alice._address);
    }
    expect((await xToken.balanceOf(alice._address)).toString()).to.equal("0");

    console.log();
    console.log("✓ XVault: mintERC20s, redeemERC721s");
    console.log();

    await checkBalances();
    // return;

    // XVault: *.mintAndRedeemMultiple

    aliceNFTs = await getUserHoldings(alice._address, 20);
    bobNFTs = await getUserHoldings(bob._address, 20);
    await xVault.connect(bob).mintERC20s(bobNFTs);
    await xVault.connect(alice).mintAndRedeemMultiple(aliceNFTs);
    let _aliceNFTs = await getUserHoldings(alice._address, 20);
    let list = [];
    for (let i = 0; i < 10; i++) {
      const item = _aliceNFTs[i];
      list.push(aliceNFTs.includes(item) ? 0 : 1);
    }
    console.log(list);
    await xToken.connect(bob).approve(xVault.address, BASE.mul(10).toString());
    await xVault.connect(bob).redeemERC721s(10);

    // Manageable

    await expectRevert(
      xVault.connect(initialOwner).migrate(initialOwner._address)
    );
    await expectRevert(xVault.connect(alice).transferOwnership(carol._address));
    await expectRevert(xVault.connect(carol).transferOwnership(carol._address));
    await xVault.connect(initialOwner).transferOwnership(carol._address);
    await expectRevert(xVault.connect(carol).migrate(carol._address));
    await xVault.connect(carol).initiateUnlock(0);
    await xVault.connect(carol).initiateUnlock(1);
    await expectRevert(xVault.connect(carol).changeTokenName("Name"));
    await expectRevert(xVault.connect(carol).changeTokenSymbol("NAME"));
    await xVault.connect(carol).initiateUnlock(2);
    await expectRevert(xVault.connect(carol).migrate(carol._address));
    await checkBalances();
    await xVault.connect(carol).lock(0);
    await xVault.connect(carol).lock(1);
    await xVault.connect(carol).lock(2);

    if (!(await checkBalances())) return;
    console.log();
    console.log("✓ Manageable");
    console.log();

    aliceNFTs = await getUserHoldings(alice._address, 20);
    bobNFTs = await getUserHoldings(bob._address, 20);

    ////////////////////
    // Timelock.Short //
    ////////////////////

    await expectRevert(
      xVault.connect(carol).mintRetroactively(aliceNFTs[0], alice._address)
    );
    await nft
      .connect(alice)
      .transferFrom(alice._address, xVault.address, aliceNFTs[0]);
    ////////////////////////////////////////////////////////////////////////
    await xVault.connect(carol).initiateUnlock(0);
    console.log("waiting...");
    await new Promise((resolve) => setTimeout(() => resolve(), 3000));
    ////////////////////////////////////////////////////////////////////////
    await expectRevert(xVault.connect(alice).mintERC20(aliceNFTs[0]));
    await expectRevert(
      xVault.connect(carol).mintRetroactively(bobNFTs[0], alice._address)
    );
    await xVault.connect(carol).mintRetroactively(aliceNFTs[0], alice._address);
    await xToken.connect(alice).transfer(xVault.address, BASE.div(2));
    await expectRevert(
      xVault.connect(carol).redeemRetroactively(alice._address)
    );
    await xToken.connect(alice).transfer(xVault.address, BASE.div(2));
    await xVault.connect(carol).redeemRetroactively(alice._address);
    ////////////////////////////////////////////////////////////////////////
    await xVault.connect(carol).lock(0);

    console.log();
    console.log("✓ Timelock.Short");
    console.log();

    /////////////////////
    // Timelock.Medium //
    /////////////////////

    aliceNFTs = await getUserHoldings(alice._address, 20);
    bobNFTs = await getUserHoldings(bob._address, 20);

    // if (!(await checkBalances())) return;
    await checkBalances();
    await expectRevert(xVault.connect(carol).changeTokenName("Name"));
    await expectRevert(xVault.connect(carol).changeTokenSymbol("NAME"));
    await expectRevert(xVault.connect(carol).setMintFees([1, 1, 1]));
    await expectRevert(xVault.connect(carol).setBurnFees([1, 1, 1]));
    await expectRevert(xVault.connect(carol).setDualFees([1, 1, 1]));
    ////////////////////////////////////////////////////////////////////////
    await xVault.connect(carol).initiateUnlock(1);
    console.log("waiting...");
    await new Promise((resolve) => setTimeout(() => resolve(), 3000));
    ////////////////////////////////////////////////////////////////////////

    // Manageable: *.changeTokenName, *.changeTokenSymbol

    await expectRevert(xVault.connect(alice).changeTokenName("Name"));
    await expectRevert(xVault.connect(alice).changeTokenSymbol("NAME"));
    await xVault.connect(carol).changeTokenName("Name");
    await xVault.connect(carol).changeTokenSymbol("NAME");
    expect(await xToken.name()).to.equal("Name");
    expect(await xToken.symbol()).to.equal("NAME");

    // Profitable: *.setMintFees

    await xVault.connect(carol).setMintFees([2, 2, 2]);
    await expectRevert(
      xVault.connect(alice).mintERC20(aliceNFTs[0], { value: 1 })
    );
    await xVault.connect(alice).mintERC20(aliceNFTs[0], { value: 2 });
    await expectRevert(
      xVault.connect(alice).mintERC20s(aliceNFTs.slice(2, 5), { value: 7 })
    );
    await xVault.connect(alice).mintERC20s(aliceNFTs.slice(2, 5), { value: 8 });
    await checkBalances();
    // Profitable: *.setDualFees
    aliceNFTs = await getUserHoldings(alice._address, 20);
    await xVault.connect(carol).setDualFees([2, 2, 2]);
    await expectRevert(
      xVault.connect(alice).mintAndRedeem(aliceNFTs[1], { value: 1 })
    );
    await xVault.connect(alice).mintAndRedeem(aliceNFTs[1], { value: 2 });

    await expectRevert(
      xVault
        .connect(alice)
        .mintAndRedeemMultiple(aliceNFTs.slice(2, 5), { value: 7 })
    );
    await xVault
      .connect(alice)
      .mintAndRedeemMultiple(aliceNFTs.slice(2, 5), { value: 8 });
    ////////////////////////////////////////////////////////////////////////

    // Profitable: *.setIntegrator
    aliceNFTs = await getUserHoldings(alice._address, 20);

    await expectRevert(
      xVault.connect(alice).setIntegrator(alice._address, true)
    );
    await expectRevert(xVault.connect(alice).mintERC20(aliceNFTs[0]));
    await xVault.connect(carol).setIntegrator(alice._address, true);
    await xVault.connect(alice).mintERC20(aliceNFTs[0]);

    await xToken.connect(alice).approve(xVault.address, BASE.mul(4).toString());
    await xVault.connect(alice).redeemERC721s(4);
    await xVault.connect(carol).setIntegrator(alice._address, false);
    await xVault.connect(carol).setMintFees([0, 0, 0]);
    await xVault.connect(carol).setDualFees([0, 0, 0]);

    // Controllable: *.setController, *.directRedeem

    let vaultNFTs = await getUserHoldings(xVault.address, 20);

    await expectRevert(
      xVault.connect(alice).setController(alice._address, true)
    );
    await expectRevert(xVault.connect(bob).setController(alice._address, true));
    await xToken.connect(alice).approve(xVault.address, BASE);
    await expectRevert(
      xVault.connect(alice).directRedeem(vaultNFTs[0], alice._address)
    );
    await expectRevert(
      xVault.connect(alice).directRedeem(vaultNFTs[0], bob._address)
    );
    await xVault.connect(carol).setController(alice._address, true);
    await xVault.connect(alice).directRedeem(vaultNFTs[0], alice._address);
    expect(await nft.ownerOf(vaultNFTs[0])).to.equal(alice._address);

    console.log();
    console.log("✓ Controllable");

    //
    await xVault.connect(carol).setController(alice._address, false);
    await xVault.connect(alice).mintERC20(vaultNFTs[0]);
    await xVault.connect(carol).lock(1);
    console.log();
    console.log("✓ Timelock.Medium");
    console.log();

    ///////////////////
    // Timelock.Long //
    ///////////////////

    aliceNFTs = await getUserHoldings(alice._address, 20);
    bobNFTs = await getUserHoldings(bob._address, 20);

    await expectRevert(xVault.connect(carol).migrate(bob._address));
    ////////////////////////////////////////////////////////////////////////
    await xVault.connect(carol).initiateUnlock(2);
    console.log("waiting...");
    await new Promise((resolve) => setTimeout(() => resolve(), 3000));
    ////////////////////////////////////////////////////////////////////////
    await xVault.connect(carol).setBurnFees([2, 2, 2]);
    await xToken.connect(alice).approve(xVault.address, BASE);
    await expectRevert(xVault.connect(alice).redeemERC721({ value: 1 }));
    await xVault.connect(alice).redeemERC721({ value: 2 });
    await xVault.connect(alice).mintERC20s(aliceNFTs);
    const bobBal = parseInt((await nft.balanceOf(bob._address)).toString());
    const vaultBal = parseInt((await nft.balanceOf(xVault.address)).toString());
    await xVault.connect(carol).migrate(bob._address);
    expect((await nft.balanceOf(bob._address)).toString()).to.equal(
      (bobBal + vaultBal).toString()
    );
    for (let i = 0; i < aliceNFTs.length; i++) {
      await nft
        .connect(bob)
        .transferFrom(bob._address, xVault.address, aliceNFTs[i]);
    }
    ////////////////////////////////////////////////////////////////////////
    await xVault.connect(carol).setBurnFees([0, 0, 0]);
    await xVault.connect(carol).lock(2);

    console.log();
    console.log("✓ Timelock.Long");

    // Pausable: *.pause, *.unpause & XVaultSafe: *.simpleRedeem

    aliceNFTs = await getUserHoldings(alice._address, 20);
    bobNFTs = await getUserHoldings(bob._address, 20);
    await expectRevert(xVault.connect(alice).pause());
    await expectRevert(xVault.connect(alice).unpause());
    await xToken.connect(alice).approve(xVault.address, BASE);
    await expectRevert(xVault.connect(alice).simpleRedeem());
    await xVault.connect(carol).pause();
    let aliceBal = await xToken.balanceOf(alice._address);
    let balance = await xToken.balanceOf(alice._address);
    await xVault.connect(alice).simpleRedeem();
    expect((await xToken.balanceOf(alice._address)).toString()).to.equal(
      balance.sub(BASE).toString()
    );

    console.log();
    console.log("✓ Pausable");
    console.log();

    //
  });
});