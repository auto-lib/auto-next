
type Fn = {
}
type Pubsub = {
}
type Cache = {
}

type Setup = {
  fn: Fn,
  pubsub: Pubsub,
  cache: Cache,
}

export default function auto(setup: Setup): Function {

  return function (obj: object) {
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
}