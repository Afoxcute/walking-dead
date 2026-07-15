// Blockchain reactivity removed — stubs for compatibility
export function createReactivitySDK(_opts: unknown): unknown { return {}; }
export function createReactivityPublicClientWebSocket(): unknown { return null; }
export async function subscribeOffChain(_client: unknown, _opts: unknown): Promise<null> { return null; }
export async function subscribeOffChainWildcard(_client: unknown, _opts: unknown): Promise<null> { return null; }
export async function createSoliditySubscription(_sdk: unknown, _opts: unknown): Promise<Error> { return new Error('disabled'); }
export async function getSubscriptionInfo(_sdk: unknown, _id: unknown): Promise<Error> { return new Error('disabled'); }
export async function cancelSoliditySubscription(_sdk: unknown, _id: unknown): Promise<Error> { return new Error('disabled'); }
export async function createOnchainBlockTickSubscription(_sdk: unknown, _opts: unknown): Promise<Error> { return new Error('disabled'); }
export async function scheduleOnchainCronJob(_sdk: unknown, _opts: unknown): Promise<Error> { return new Error('disabled'); }
