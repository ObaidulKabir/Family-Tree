import { spawn } from 'node:child_process'

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: true })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

await run('prisma', ['generate'])

if (process.env.VERCEL) {
  await run('prisma', ['migrate', 'deploy'])
}

await run('next', ['build', '--webpack'])

