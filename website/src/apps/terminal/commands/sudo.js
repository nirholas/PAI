export const description = 'Execute as superuser'

export default function sudo(_args, _term) {
  return '<span class="t-warn">pai is not in the sudoers file. This incident will be reported. (Just kidding — it won\'t.)</span>'
}
