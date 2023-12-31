
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

## rant more

right, so here is how i think to think about this:

you have a function. you run the function, and it
produces a result:

```ts
const f = () => 'hello';
const r = f();
```

now we want to cache this result - instead of
the function running we instead pull the value
from somewhere we've saved the result.

```ts
const c = {
    f: {
        fn: () => 'hello',
        vn: null
    }
};

const get = (c,n) => {
    const ch = c[n];
    if (!ch) throw 'nope';
    if (!ch.vn) ch.vn = ch.fn();
    return ch.vn;
}
```

i think i can do it cleaner ... why have an
object keep the function return value?

but i really like this - this is what i wanted,
to build things up carefully, one step at a time ...

so:

1. define function, no params, no dependencies ...
2. define cache: takes in a function (with a name ...),
   saves the output
3. .... ???

lots more to do:

- function with parameters
- function with dependencies ... (?)
- cache with multiple layers ...
- async cache ...
- cache invalidation / ttl ?

right, and then each step ... we can ... test each
layer.

and this approach might inform how to ... break this
up. how to design things ...

and then the tests, i suppose we have tests for each
step ... and then we'll have to have ...

## another try

let's try again. we have an object, called `cache`,
and it has a function called `register` which takes
in an object - it expects it to look like this:

```ts
const obj = {
    key: params => `${params}`,
    value: params => params,
    validate: params => params != null
}
```

`key` is the ... it's a function which ... takes
in the parameters, a single parameter (will use
an object to encode a lot ... or an array), and
returns a string. `register` will error if key
does not exist, or if key is not a function or
a string ...

`value` is a function too. it takes in a parameter
and returns, well ... anything. `register` will
error if ... it's not a function, or if it doesn't
exist ...

> what about async/sync ? should we just make `value`
> always be async ... ?

`validate` is optional. it must be a function as well.
it simply takes in an object, parameter, and is there
to validate the call. should return a boolean ...

what else - hooks? maybe i could ... have another
member that lists a bunch of hooks, like `not_valid`
or `pre_request` and `post_request` ...

the idea i'm going for is ... to model this as a server.
every one of these cache objects is like a mini server -
it takes in a request and produces a response. the point
of `validate` is to validate the request. the point of
`value` is to get the response. the point of `key` is
to ... serialise the request so that it can be indexed,
and so we can store the response value somewhere ...

right, i really like this idea - `cache` is kind of a
container for various servers. it handles requests -
you tell it "i want to get from this server" and it
then does various things - checks if the request is
valid, gets a serialised version of the request, then
checks if it has the value in cache, perhaps then
fetching the value from the external cache ...

the cache itself has a structure - it has, for one thing,
layers. this is serial, it starts with layer 0, then
layer 1, etc. it has a policy for access - for example,
first check layer 0, then, if it's not there, check for
layer 1, etc. the policy could be different. it could
just have one layer. we could also have a policy of - run
up the layers, if it's not there, generate the value with
the `value` function and then save up all the layers / fill
the layers with said value...

i also need various methods ... one, really, which is
`fill_all_keys` or something, which looks at all the
keys for a given server (based on ... all the requests?)
and then refreshes them ... i guess i should say `refresh_all_keys` ...

actually what i need is ... a function which ... refreshes
the keys in batches ... which means i need to store when
it was last refreshed ...

and to test this won't be so bad - i could just have multiple
layers artificially ...

the only thing is ... in reality the first layer, layer 0, is
really an in-memory layer, it's just an object ... which means
it's synchronous ... and then layer 1 is deno kv ... which is
asynchronous ...

what else? for deno kv i have to limit the access - i can't ...
to refresh the value i can't just write whatever the new value
is over, because i am limited by the number of write bytes,
you pay for them ... so to optimise i have to 1. save a
compressed version on kv, 2. have a hash of this compressed value
3. generate the value locally, 4. compress and hash, 5. fetch
the hash from kv, 5. compare said hash ...

so ... what methods do i need for this? well, one thing is it
has nothing to do with the server ... this is a hash thing.

that's a good distinction - server, and cache. the server generates
the value, and handles the request. the cache does the rest - i
could have the same server but a cache that, say, doesn't save
to kv, or doesn't compress, or doesn't use hashes ...

but ... it would be nice to ... have all these features for the
cache be generic, like, you pass in how many layers the cache
has, what function it uses to save things, check if they exist,
etc etc ... much like how you define the server.

## where we at

so we have:

1. a list of objects / servers ...
2. a list of caches ...
3. the servers have a particular structure
4. the caches all have the same set of methods, e.g. `register`
5. the caches need to return ... i dunno, i guess it doesn't _need_ to ...

let's do some psuedo code:

```ts
import cache from './cache.ts';
import servers from './servers.ts';

servers.map(server => cache.register(server));
```

that's nice ... what's cool is that ... it literally covers
everything ... every use case, i think ... could be covered
with this.

now we just need to decide ... on the access methods ...

```ts
const data = await cache.dataset('blue');
```

will this work? can i make ... the `register` method change
the underlying object?

