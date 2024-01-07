
import auto from './auto.ts';
import fn from './fn.ts';
import pubsub from './pubsub.ts';
import cache from './cache.ts';

const get_db_json = async (products: string[]) => {
    const db_json = await fetch('https://example.com/db.json');
    return db_json;
}

const _ = auto({fn, pubsub, cache})({

    dataset: (name:string) => ({
        key: `dataset_${name}`,
        val: async (_,set) => {
            const products = _.products;
            //...
            const db_json = await get_db_json(products);
            set(db_json);
        }
    })
})