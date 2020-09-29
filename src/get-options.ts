import chalk from 'chalk'
import yargs from 'yargs'

const exampleAddress = '/ip4/192.168.1.23/tcp/5556/p2p/12D3KooWSEXpjM3CePSAfmjYDo4dfFUgcNW55pFK3wfukhT1FMtB'

export const getOptions = () => {
  const { argv } = yargs
    .usage(
      chalk.blueBright`Usage: -m <other peer multiaddr> -p <number>` +
        chalk.green`\n\nExample: npm run start -- -- -m ${exampleAddress} -p 10333`,
    )
    .option('m', {
      alias: 'multiaddr',
      describe: 'Multiaddr of Server peer to dial',
      type: 'string',
      demandOption: true,
    })
    .option('p', { alias: 'port', describe: 'Port to listen on', type: 'number', demandOption: true })

  if (isNaN(argv.p)) {
    console.log('Invalid port', argv.p)
    process.exit(1)
  }

  console.log('Options')
  console.log(`  multiaddr: ${argv.m}`)
  console.log(`  port     : ${argv.p}`)
  console.log('----------------------')

  return argv
}
