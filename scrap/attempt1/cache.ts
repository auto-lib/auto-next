
type Server = {
    name: string;
    data: any;
};

// Initialize an empty cache object
const cache: { [key: string]: any } = {};

// Function to register a server
function register(server: Server) {
    cache[server.name] = async () => server.data;
}

// Export the cache object and the register function
export { cache, register };
