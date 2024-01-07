
const auto = <T extends Record<string, Function>>(obj: T): { [K in keyof T]: T[K] } => {

    // Create a new object to store the bound methods
    const bound: { [K in keyof T]: T[K] } = {} as any;

    // Iterate over the keys of the input object
    for (const key in obj) {
        // Ensure the key belongs to the object itself, not its prototype chain
        if (obj.hasOwnProperty(key)) {
            // Bind the function to the new object and assign it
            bound[key] = obj[key].bind(bound);
        }
    }

    // Return the new object with bound methods
    return bound;
}

const _ = auto({
    hello: (name: string) => ({
        key: `x-${name}`,
        value: `Hello, ${name}`
    })
});

const msg = _.hello('world');

console.log(msg);