export const description = 'Close the terminal'

export default function exit(_args, term) {
  term.close()
  return null
}
