const { expect } = require('chai');
const { sha256, randomSecretWord } = require('./base/helpers');

describe('expire', function () {
    let owner;
    let erc20;
    let flippening;

    beforeEach(async () => {
        [ owner ] = await ethers.getSigners();

        const ERC20 = await ethers.getContractFactory('ERC20Basic');
        erc20 = await ERC20.deploy();
        await erc20.deployed();

        const Flippening = await ethers.getContractFactory('Flippening');
        flippening = await Flippening.deploy(owner.address, 60, 60);
        await flippening.deployed();
    });

    it('Should not emit a Settled event when expiring an event that has not expired', async () => {
        let counter = 0;

        for (const choice of [true, false]) {
            await erc20.approve(
                flippening.address,
                ethers.utils.parseEther('3'),
            );

            const secret = `${randomSecretWord()} ${choice}`;

            await flippening.create(
                await sha256(secret),
                erc20.address,
                ethers.utils.parseEther('1'),
            );

            await flippening.guess(counter, `${choice}`);

            await network.provider.send('evm_increaseTime', [3600 * 2 - 1]);

            await expect(flippening.expire(counter))
                .to.be.revertedWith('Expiration + gracetime has not passed');

            counter += 1;
        }
    });

    it('Should emit a Settled event when expiring an event that has a guess', async () => {
        let counter = 0;

        for (const choice of [true, false]) {
            await erc20.approve(
                flippening.address,
                ethers.utils.parseEther('3'),
            );

            const secret = `${randomSecretWord()} true`;

            await flippening.create(
                await sha256(secret),
                erc20.address,
                ethers.utils.parseEther('1'),
            );

            await flippening.guess(counter, 'true');

            await network.provider.send('evm_increaseTime', [3600 * 2]);

            await expect(flippening.expire(counter))
                .to.emit(flippening, 'Settled')
                .withArgs(counter, owner.address, false);

            counter += 1;
        }
    });

    it('Should emit a Reward event indicating the reward paid out to the guesser', async () => {
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

        await flippening.guess(0, 'false');

        await network.provider.send('evm_increaseTime', [3600 * 2]);

        await expect(flippening.expire(0))
            .to.emit(flippening, 'Reward')
            .withArgs(0, ethers.utils.parseEther('0.01'));
    });

    it('Rejects duplicate expire attempt gracefully', async () => {
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

        await flippening.guess(0, 'true');

        await network.provider.send('evm_increaseTime', [3600 * 2]);

        await flippening.expire(0);

        await expect(flippening.expire(0))
            .to.be.revertedWith('Flip already settled');
    });
});
