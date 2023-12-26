
export default function auto(obj: Record<string, Function>) {
    let names = Object.keys(obj);
    console.log(`found ${names.length} name(s)`);

  return {
    name: 'auto',
    parse(text: string) {
      return text
    },
    stringify(text: string) {
      return text
    },
  }
}