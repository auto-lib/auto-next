import { cache, register } from './cache.ts';
import servers from './servers.ts';

servers.forEach(server => register(server));

const blueData = await cache.blue();
console.log('Data from blue server:', blueData);

const redData = await cache.red();
console.log('Data from red server:', redData);
