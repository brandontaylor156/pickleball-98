// My Park's spatial voice was 98ish's (its voice relay and TURN servers): the standalone game
// has no voice chat, so the park menu's Voice and the mic chip stay hidden (supported: false).
//   -> { supported, state, toggle(), session }
const NO_VOICE = { status: "off", peers: {}, on: [] }

export const useParkVoice = () => ({ supported: false, state: NO_VOICE, toggle: () => {}, session: null })
