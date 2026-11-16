// A mocked Filecoin RPC node for the e2e tests: made-up data sets (500 at
// provider 9, 501 at provider 2), providers, pieces and payer, answered from
// a table of contract calls. Nothing leaves the test.
import { bytesToHex, decodeFunctionData, encodeFunctionResult, isAddressEqual, multicall3Abi, numberToHex } from 'viem';
import { calibration } from '@filoz/synapse-core/chains';
import { encodePDPCapabilities } from '../node_modules/@filoz/synapse-core/dist/src/utils/pdp-capabilities.js';

export const PAYER = '0x00000000000000000000000000000000000000aa';
const TOKEN = '0x00000000000000000000000000000000000000bb';
const PERIOD = 240n;
export const NOW = BigInt(Math.floor((Date.now() / 1000 - calibration.genesisTimestamp) / 30));
const ACT = NOW - 20n * PERIOD - 10n;

/** The chain's answers, by function name. Data set 500 at provider 9 is healthy; 501 at provider 2 missed two periods. */
export function answers(piece) {
	const provider = (id) => {
		const [capabilityKeys, productCapabilityValues] = encodePDPCapabilities({
			serviceURL: `https://sp${id}.example.com`, minPieceSizeInBytes: 127n, maxPieceSizeInBytes: 1n << 35n, ipniPiece: false, ipniIpfs: false,
			storagePricePerTibPerDay: 1n, minProvingPeriodInEpochs: 30n, location: id === 9n ? 'C=DE;L=Musterstadt' : 'C=NL;L=Beispieldorp', paymentTokenAddress: TOKEN
		});
		return { providerId: id, providerInfo: { serviceProvider: PAYER, payee: PAYER, name: `Anbieter ${id}`, description: '', isActive: true }, product: { productType: 0, capabilityKeys, isActive: true }, productCapabilityValues };
	};
	const info = (dataSetId, providerId) => ({
		pdpRailId: dataSetId + 1000n, cacheMissRailId: 0n, cdnRailId: 0n, payer: PAYER, payee: PAYER, serviceProvider: PAYER, commissionBps: 0n,
		clientDataSetId: dataSetId, pdpEndEpoch: 0n, providerId, pendingOneTimePayments: 0n, lifecycleReserveBalance: 0n, dataSetId
	});
	return {
		getClientDataSets: () => [info(500n, 9n), info(501n, 2n)],
		dataSetLive: () => true,
		getDataSetListener: () => calibration.contracts.fwss.address,
		getAllDataSetMetadata: () => [['app'], ['paperless-backup-test']],
		getDataSetLeafCount: () => 4n,
		getProviderWithProduct: (id) => provider(id),
		getActivePiecesByCursor: (ds) => [[{ data: bytesToHex(piece.bytes) }], [ds === 500n ? 3n : 5n], false],
		pieceLive: () => true,
		getDataSetLastProvenEpoch: () => NOW - 100n,
		getNextChallengeEpoch: () => NOW + 120n,
		provingDeadline: () => ACT + 21n * PERIOD,
		provenThisPeriod: () => false,
		provingActivationEpoch: () => ACT,
		getPDPConfig: () => [Number(PERIOD), 20n, 5n, 0n],
		getDataSet: (ds) => info(ds, ds === 500n ? 9n : 2n),
		provenPeriods: (ds, p) => !(ds === 501n && (p === 4n || p === 11n)),
		getRail: () => ({ token: TOKEN, from: PAYER, to: PAYER, operator: PAYER, validator: PAYER, paymentRate: 1n, lockupPeriod: 86400n, lockupFixed: 0n, settledUpTo: 0n, endEpoch: 0n, commissionRateBps: 0n, serviceFeeRecipient: PAYER }),
		accounts: () => [1000n + 120n * 2880n, 1000n, 1n, NOW]
	};
}

/** An RPC node answering eth_call from `table`, through multicall3 as well. */
export function rpc(table) {
	const c = calibration.contracts;
	const contracts = [c.pdp, c.fwssView, c.filecoinPay, c.serviceProviderRegistry];
	const call = (to, data) => {
		const contract = contracts.find((x) => isAddressEqual(x.address, to));
		if (!contract) throw new Error(`unknown ${to}`);
		const { functionName, args } = decodeFunctionData({ abi: contract.abi, data });
		if (!table[functionName]) throw new Error(`reverted: ${functionName}`);
		return encodeFunctionResult({ abi: contract.abi, functionName, result: table[functionName](...(args ?? [])) });
	};
	const one = ({ method, params }) => {
		if (method === 'eth_chainId') return numberToHex(calibration.id);
		if (method === 'eth_blockNumber') return numberToHex(NOW);
		if (method !== 'eth_call') throw new Error(method);
		const { to, data } = params[0];
		if (!isAddressEqual(to, c.multicall3.address)) return call(to, data);
		const { args } = decodeFunctionData({ abi: multicall3Abi, data });
		const results = args[0].map((x) => {
			try {
				return { success: true, returnData: call(x.target, x.callData) };
			} catch {
				return { success: false, returnData: '0x' };
			}
		});
		return encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: results });
	};
	const answer = (req) => {
		try {
			return { jsonrpc: '2.0', id: req.id, result: one(req) };
		} catch (e) {
			return { jsonrpc: '2.0', id: req.id, error: { code: 3, message: String(e.message) } };
		}
	};
	return (route) => {
		const body = JSON.parse(route.request().postData() ?? '{}');
		route.fulfill({ json: Array.isArray(body) ? body.map(answer) : answer(body), headers: { 'access-control-allow-origin': '*' } });
	};
}

