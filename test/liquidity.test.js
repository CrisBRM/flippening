const { expect } = require('chai');
const { sha256, randomSecretWord } = require('./base/helpers');

describe('liquidity', function () {
    let owner;
    let flip;
    let erc20;
    let wavax;
    let joeFactory;
    let joeRouter;
    let flippening;

    beforeEach(async () => {
        [ owner ] = await ethers.getSigners();

        const ERC20 = await ethers.getContractFactory('ERC20Basic');
        erc20 = await ERC20.deploy();
        await erc20.deployed();

        const WAVAX = await ethers.getContractFactory('WAVAX');
        wavax = await WAVAX.deploy();
        await wavax.deployed();

        const JoeFactory = await ethers.getContractFactory('JoeFactory');
        joeFactory = await JoeFactory.deploy(owner.address);
        await joeFactory.deployed();

        const pairCodeHash = await joeFactory.pairCodeHash();
        console.log('pairCodeHash', pairCodeHash); // needed to override npm package hardcoded value

        const JoeRouter = await ethers.getContractFactory('JoeRouter02');
        joeRouter = await JoeRouter.deploy(joeFactory.address, wavax.address);
        await joeRouter.deployed();

        const Flippening = await ethers.getContractFactory('Flippening');
        flippening = await Flippening.deploy(
            owner.address,
            60,
            60,
            wavax.address,
            joeRouter.address,
        );
        await flippening.deployed();

        const FLIP = await ethers.getContractFactory('FLIP');
        flip = await FLIP.deploy(flippening.address);
        await flip.deployed();

        await flippening.setFlipsAddress(flip.address);

        // await wavax.approve(
        //     flippening.address,
        //     ethers.utils.parseEther('1000'),
        // );

        // await flip.transfer(flippening.address, ethers.utils.parseEther('1'));
        await wavax.transfer(flippening.address, ethers.utils.parseEther('1000'));
    });

    it('provideLiquidity() function should create liquidity', async () => {
        await flippening.provideLiquidity(ethers.utils.parseEther('0.5'));
    });

    it('convertToWAVAX() function should convert incoming tokens to WAVAX', async () => {
        // Provide liquidity so that pair is created
        await flippening.provideLiquidity(ethers.utils.parseEther('0.5'));

        await flippening.convertToWAVAX(flip.address, ethers.utils.parseEther('0.5'));
    });

    it('processFees() function should convert fee to WAVAX and provide liquidity', async () => {
        // Provide liquidity so that pair is created
        await flippening.provideLiquidity(ethers.utils.parseEther('0.5'));

        await flip.approve(
            flippening.address,
            ethers.utils.parseEther('2'),
        );

        const secret = `${randomSecretWord()} true`;

        await flippening.create(
            await sha256(secret),
            flip.address,
            ethers.utils.parseEther('1'),
        );

        await flippening.guess(0, 'false');

        await flippening.processFees(0);

        // Provide liquidity so that pair is created
        // await flippening.provideLiquidity(ethers.utils.parseEther('0.5'), ethers.utils.parseEther('0.5'));

        // await flippening.convertToWAVAX(flip.address, ethers.utils.parseEther('0.5'));
    });

    it('provideLiquidity() function should not change price ', async () => {
        // Provide liquidity so that pair is created
        await flippening.provideLiquidity(ethers.utils.parseEther('1000'));

        const erc20Amount = ethers.utils.parseEther('100000');
        const wavaxAmount = ethers.utils.parseEther('50');
        erc20.approve(joeRouter.address, erc20Amount); // use same amonut of flips as avax tokens
        wavax.approve(joeRouter.address, wavaxAmount);

        const response = await joeRouter.addLiquidity(
            erc20.address, // tokenA address (flips)
            wavax.address, // tokenB address (wavax)
            erc20Amount, // flip token <- just use same value as avax amount since the contract can mint unlimited supply
            wavaxAmount, // tokenB amount desired
            erc20Amount, // tokenA amount min (flips)
            wavaxAmount, // tokenB amount min (wavax)
            // owner, // to
            flippening.address,
            99999999999999, // some large number that is not going to hit the limit TODO: use actual block number in test
        );

        const flipAndGuess = async (index) => {
            await erc20.approve(
                flippening.address,
                ethers.utils.parseEther('2'),
            );

            const secret = `${randomSecretWord()} true`;

            await flippening.create(
                await sha256(secret),
                erc20.address,
                ethers.utils.parseEther('1'),
            );

            await flippening.guess(index, 'false');
        };

        for (const index in [...Array(5).keys()]) {
            await flipAndGuess(index);
            await flippening.processFees(index);
        };

        // Provide liquidity so that pair is created
        // await flippening.provideLiquidity(ethers.utils.parseEther('0.5'), ethers.utils.parseEther('0.5'));

        // await flippening.convertToWAVAX(flip.address, ethers.utils.parseEther('0.5'));
    });
});
