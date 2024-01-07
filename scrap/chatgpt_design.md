i'm struggling to figure out how to start on this rewrite project i'm working on. i'd like to come up with a plan for how to proceed. i think my main issue is trying to break things into pieces, figuring out what the use cases and tests are, and how to lay this all out in a way that i can iterate through, iterate through the design, iterate through the tests ... i've been writing about it. could you help me figure out how to start, or perhaps some questions to ask in order to understand an approach that might work? here is the document of me thinking about it:


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

## cache type

i actually don't need the same functionality as before - 
see, what the old auto did was update values based on
their dependences: you set a value, then it updates any
functions based on that value / that depends on that value,
then it updates subsequent values, and then also fires any
subscription functions on these ...

my new requirement is different - i'm going to have a cron
that runs every minute and updates all the values, or
_refreshes_ them. so ... really all auto is is a cache with
a particular update policy - don't do anything until a value
is changes explicitly / from the outside. it also depends on
a particular definition of what a 'function' is that determines
the generating methods - it's one with a context, really a special
cache that not only returns the current cache value but saves the
value of the parent in a dependency list ...

## objects

i had this interesting approach to building auto using various
objects you pass in - a cache, a pubsub object, and an error
object...

## tests

building things up worked best with tests ... in fact, i like
the idea that a test is really the best way to define the
library itself - you say "ok, this is how it should work, at
most basic". then you add features, adding tests...

what is the most basic feature?

i want to ... find the generic thing that ... encapsulates all
my use cases ...

## splitting

i'm really trying to do a few things:

1. split out the cache into a kind of generic object that can
   use any kind of back end ...
2. use the cache to track dependencies ... it is used as the
   access, after. i think just with hooks, with a parent
   indicator, would work ...
3. function parameters. meaning each function must be able
   to specify parameters, and they must thus have to produce
   a key function, which returns a string based on the
   parameters ...

and i want to build up the tests based on this / these new
approaches, i want to ... try to be more methodical about
tests ...

ok. so ... we have an object, a cache. what about ... taking
functions and converting them into ... that must be a separate
thing, taking a function ... it's what you run if you get a
cache miss, or want to refresh the cache ... or you want to
update the cache because something changed ...

## more rant

i'm not sure how to make progress here except to just ... keep
ranting about it.

ok, so we have a cache. we want to separate that out. it's just
something that ... we get and set from. and have hooks to. is
that it? just an object with get and set?

ok, the other thing is functions. we want to define ... a function,
that ... well, it produces a value. how do we attach this to
the cache?

in the end we will have .. an object with a get method, and a
set method, much like the cache. and it will ... pull from the
cache. and you will be able to ... refresh it, refresh values
with a cron. and ... when you set values you will be able to,
it will have a pubsub system to ... update values ...

i'm sure in retrospect this will all seem really straight forward
and obvious, how these pieces should be split apart and connected,
but right now it's not obvious ...

and the cache, i want the cache to have layers - a local layer
and an external, for example. the local is just in memory, just
an object, the external something like a kv store or database.
something with an await.

is that it? is seems like ... there's only a few pieces. it
also feels like there's a lot of potential, like if i just get
the policies right here i could extend this ... like, the pubsub
architecture, could i have things split over multiple objects,
over different ... execution environments? like an object in the
browser ... and another on a server ...

maybe ... maybe one way to do this is through this signals idea - 
i've shown it is a good architecture for asynchronous code, it's
how the javascript engine works. should ... i just build everything
around that? so ... you define two sets of signals, immediate and
deferred. and ... so in that way the design of the system, the cache
and pubsub and function runners, are simply a set of signal names,
what their values represent, who produces what signal (i.e. which
signal produces what signals...), and the state - the shape of it,
and what it means ...

then you can happily diagnose the system at any time just by looking
at those things - which signals have been registered, what the
current signal queue looks like, and what the state looks like.

that would be a great place to start, or at least - how build out
a system with tests.

right, so ... for the testing framework you ... give the framework
an object, which is a signal runner ... or you pass in the signal
definitions to the runner ... and then you give it some signals,
pass in some, maybe or maybe not, then you step through, maybe
run until it's flush, until there are no more signals left, with
a time limit ... and then have an output, things you check for - 
basically what the state is. you could, in theory, check the state
of the signal queue after one or two steps ...

ok but it doesn't really test the fundamentals of each object,
like the cache, like pubsub, the the function ...

## wedge

i'm trying to find a wedge. a start, a place to stand. just one
inch ahead, one place i know is true ... what do i _know_ i will
need to have?

## first test

struggling to start. what do i know? i want a bunch of tests,
each small, each taking something in, checking things ...

ok, and i want tests for the cache, and for pubsub, and for fn...
and for the combination ... let's so that, let's split these
tests up into four parts.

the cache tests are easiest. ok, let's say the first tests
are ... ok, we have a folder for the cache tests. and we
have various cache objects, and we want to run through each
of them for the cache ...

`/tests/cache/001_get.ts`

ok, so the test runner ... runs the cache tests, the pubsub
tests, etc ... but it also needs to know what the cache objects
to test are ...

i dunno if this is going to work. how do i .. check a different
cache? i mean, they each do different things, how ... do i check
those?

```ts
export async function test(cache, pass, fail)
{
    cache.set('one', 1);

    const val = await cache.get('one');

    if (val == 1) pass('get/set worked');
    else fail(`get/set failed, should have 1 but got ${val}`);
}
```