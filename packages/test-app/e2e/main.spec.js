const { E2E_TOKEN, CIRCLE_WORKFLOW_ID } = process.env
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

beforeEach(async () => {
	await device.reloadReactNative()
})

it('sends events and does not crash', async () => {
	await element(by.text('Screen: Home')).tap()
	await element(by.text('Track: Order Complete')).tap()
	await element(by.text('Track: Pizza Eaten')).tap()
	await element(by.text('Flush')).tap()

	await sleep(5 * 1000)
})

if (CIRCLE_WORKFLOW_ID) {
	it('sends events to the webhook', async () => {
		await element(by.text('Launch test suite')).tap()
		await element(by.text('Flush')).tap()

		await Promise.all(
			require('../src/calls.json').map(([type, ...args]) =>
				hasMatchingCall(type, ...args)
			)
		)
	})
}

const callProperties = {
	track: {
		name: 'event',
		props: 'properties'
	},
	identify: {
		name: 'userId',
		props: 'traits'
	}
}

async function hasMatchingCall(type, name, props) {
	const properties = callProperties[type]

	if (!properties) {
		throw new Error(`Unknown call type ${type}`)
	}

	for (let i = 0; i < 10; i++) {
		const headers = {
			Authorization: 'Basic ' + Buffer.from(E2E_TOKEN + ':').toString('base64')
		}
		const res = await fetch(
			'https://webhook-e2e.segment.com/buckets/ios?limit=10',
			{ headers }
		)
		const messages = await res.json()
		const message = messages.find(json => {
			const message = JSON.parse(json)

			return (
				message.type === type &&
				message[properties.name] === name &&
				message[properties.props].buildId === CIRCLE_WORKFLOW_ID
			)
		})

		if (message) {
			return
		}

		await sleep(1000)
	}

	throw new Error('Cannot find call')
}
