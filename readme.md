# HSDNS-Server

This is a DNS server with an API interface for dynamic record updates. It uses Redis to store the DNS records and User information, BNS to handle the DNS resolution and Micro as the API interface.

### Features:

The server allows you to do the following:

- Host multiple DNS zones
- Manage records from a flexible API
- Seamlessly verify ownership of records

## Getting started:

### Prerequisites:

- Linux server w/ a Dedicated IP
- NodeJS 10<
- NPM

### Required step for Ubuntu users:

This repo has been tested on a Ubuntu 18.04 server and **requires** small modifications to run on this distribution. This is due to the `system-resolved` process running on the default DNS port (53).

Using an editor change the `DNSStubListener` line in `/etc/systemd/resolved.conf` to the following:
```
DNSStubListener=no
```

Then restart the `system-resolved` process using the following command:
```
sudo systemctl restart systemd-resolved
```

To ensure that the port is free run the following command:
```
sudo lsof -i :53
```

### Install Redis into the Server:

To store the records and access information we'll use Redis. Its a fast in memory key-value store.

Use the following commands to setup the database:
```
sudo apt update

sudo apt install redis-server
```

Next we'll modify the config to make sure it's set up correctly.
```
sudo vi /etc/redis/redis.conf
```

Modify the the Redis config to enable the linux supervisor to maintain the database. Since we are using Ubuntu we'll change the `supervised` setting to `systemd`. 

```
supervised systemd
```

We'll also need to make sure that the database is bound to `localhost` so its accessible by the server. Local the following line and ensure it looks like this:

```
bind 127.0.0.1 ::1
```

After this make sure the configuration is valid and the database is running:
```
sudo systemctl restart redis.service

sudo systemctl status redis
```

**Securing the database** 
While the database is only accessible internally there are a number of steps that can be taken to reduce the possibility of loss of data or compromise. 

Try the following guide on securing a [Redis server](https://www.digitalocean.com/community/tutorials/how-to-secure-your-redis-installation-on-ubuntu-18-04).

### Setting up the HSDNS server

Now we'll actually setup the HSDNS server:
```
git clone https://github.com/Black-Wattle/hsdns-server.git

cd hsdns-server

npm i
```

Next we'll setup the `.env` file and fill out the DNS port, Redis server and auth key:
```
cp .env.example .env

vi .env
```

Now the server should be able to start and connect to the server.
```
npm start run
```

You can test the server now with the hsdns cli:
```
npm i -g hsdns

hsdns server <server ip> no-ssl

hsdns zone add testing
```
That's it you should be ready to go!

## Author

lewi 🥔

[info@blackwattle.ad](mailto:info@blackwattle.ad)

`hs1qe2yqlqnrycg24uaw45gkefnqzwc9s0pxfer22l`




