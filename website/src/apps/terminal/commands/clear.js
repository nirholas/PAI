export const description = 'Clear the terminal screen'

export default function clear(_args, term) {
  term.clear()
  return null
}
