export const parse = (source) => {
  return (async function* () {
    let bufferedData

    for await (const data of source) {
      if (bufferedData) {
        bufferedData.append(data)
      } else {
        bufferedData = data
      }

      try {
        const objStr = bufferedData.toString().replace(/\0$/, '')
        yield JSON.parse(objStr)

        bufferedData = undefined
      } catch (error) {
        // wait for more data until we can parse the json
      }
    }
  })()
}
