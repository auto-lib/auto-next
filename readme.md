
# auto-next

i've been using auto in production for a few
years now. it works well https://github.com/auto-lib/autojs

it's gone through many iterations, many different designs.

now i'm building something on top of deno deploy using
kv, and it occurs to me that it follows similar patterns
to autojs, except for the caching and async pulling/storing/
generating of values. and the notion of functions ... i want
to try build another version of auto which can handle all
of these.

## functions

the first is the notion of a cache value as a function,
that is, it has a parameter. so for example in my work i
have a _dataset_ which has a `name`. i want to have a
cache / function that takes in a variable and returns
the value accordingly:

```js
let _ = auto({
    dataset: name => ({})
})
```

previously what you pass in is a context, which
contains references to all the other variables:

```js
let _ = auto({
    x: 10,
    y: _ => _.x * 2
})
```

this worked fine for singular values but became quite
tricky when you'd have, say, an array that was based on
the values of another array ...

anyway, now i am trying to cache a server request - i
just want the output of a particular dataset, that is,
the output of a function for a particular value ...

i can simulate this by having a static variable:

```js
let _ = auto({
    name: null,
    dataset: _ => gen_dataset(_.name)
})
```

but ... this is awkward, it's forced. and how would i
have a generic caching mechanism that works with this?
somehow i need to have ... well, i need to serialise all
the variables that go into dataset ... hmmm ...

i can't quite wrap my head around this one. here is what
i'm thinking:

```js
let _ = auto({
    products: `select id, name, species, origin, type, description, "point of trade", maintainer from product`,
    active_names: `select name from dataset where "is active" = 1 order by name asc`,
    dataset: {
        param: 'name',
        func: name => _ => get_dataset(_.products, name)
    }
})
```

no idea how to think about this ...

one thing i do know - each function produces an output, which i'm going
to assume is json ... i'm going to use `JSON.stringify` to serialise.
then i'm going to compress that. then i'm going to get a hash like sha1.
then i'm going to use that to decide whether or not the cache needs to
be updated. and the cache is going to have generic set/get methods, so
i can plug in anything i want ...

maybe i can work backwards from that. everything in the cache is just
key/value. and we have a local copy of this cache - basically an in memory
copy. and all the code does is this: on `get(key)` we:

1. check if it's in the in-memory cache. if so, return
2. get the compressed/hashed version in external cache
3. if it's not there, generate actual version, compress, hash, store (we store both the compressed version and the hash)
4. if it is there, pull the compressed version, decompress, save in local cache

ok and the point of the hash is to minimise reading from the external cache (deno
deploy charges you for the size of reads). so you will have a function called
`refresh` or something which:

1. calculates the latest version of the function
2. compresses it and hashes it
3. compares this hash to the hash on the external cache
4. saves the compressed version on the external if needed, with the new hash

so ... what does this all add up to?

ok, how about this: you have some function that returns a key and a value ...
or maybe a function which returns two things: a key function, and a value function ...
and you give this function to the cacher. and then you call it through the cacher:
`cache.datasets('name')`. and it then checks if it's local, external, etc. and then
you can tell the cacher - run refresh on this every 5 minutes, or whatever... you
have `refresh.datasets('name')`...

`cacher`? is that a better word? it's not all about dependencies ... though i need
to ... include a function which ... a context ...

but the key - having the key be a string, and having everything be a function
that you can pass in variables too ... i think that's important, i think that might
solve a lot of issues ...

ok, what have we got so far?

each variable has a generation function. they take parameters. they produce a unique
key.

```js
let _ = auto({
    dataset: name => ({
        key: `dataset_${name}`,
        val: async (_,set) => {
            const products = _.products;
            //...
            const db_json = await get_db_json(products);
            set(db_json);
        }
    })
})
```

is that going to work? all i've done is added a key function ...

no where do i specify ... the local cache, the external cache ...
the hashing, the compression ...

how would i use this function?

```js
const json = await _.dataset('name');
```

how do i test this?

## testing

let's just throw in that code and try get it to work.

i've created `test.ts`, `test.sh` which just runs it, and
`auto.ts` ...