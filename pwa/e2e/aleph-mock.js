// An in-memory stand-in for Aleph's aggregates, shared by every page of a
// test (two contexts are two devices), so the tests write nothing to the network.
export function alephMock() {
	const aggregates = new Map();
	return async function install(context) {
		await context.route('https://api2.aleph.im/api/v0/messages', async (route) => {
			const { message } = route.request().postDataJSON();
			const content = JSON.parse(message.item_content);
			const forAddress = aggregates.get(message.sender) ?? {};
			forAddress[content.key] = content.content;
			aggregates.set(message.sender, forAddress);
			await route.fulfill({ json: { publication_status: { status: 'success', failed: [] }, message_status: 'processed' } });
		});
		// No relay registrations: step 4 shows none found.
		await context.route(/https:\/\/api2\.aleph\.im\/api\/v0\/posts\.json.*/, (route) => route.fulfill({ json: { posts: [] } }));
		await context.route(/https:\/\/api2\.aleph\.im\/api\/v0\/aggregates\/.*/, async (route) => {
			const url = new URL(route.request().url());
			const address = url.pathname.split('/').pop().replace('.json', '');
			const key = url.searchParams.get('keys');
			const data = aggregates.get(address);
			if (!data?.[key]) return route.fulfill({ status: 404, json: {} });
			await route.fulfill({ json: { address, data: { [key]: data[key] } } });
		});
		return aggregates;
	};
}
