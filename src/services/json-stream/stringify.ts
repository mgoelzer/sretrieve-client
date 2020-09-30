export const stringify = (source) => {
  return (async function* () {
    for await (const object of source) {
      yield JSON.stringify(object)
    }
  })()
}
