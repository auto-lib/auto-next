
import auto from './auto.ts';

const get_db_json = async (products: string[]) => {
    const db_json = await fetch('https://example.com/db.json');
    return db_json;
}

const _ = auto({
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