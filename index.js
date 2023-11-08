const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const user = process.env.DB_USER;
const pass = process.env.DB_PASS;

const uri = `mongodb+srv://${user}:${pass}@cluster0.plm4jqn.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        const usersCollection = client.db('homeyDB').collection('users')
        const servicesCollection = client.db('homeyDB').collection('services')
        const bookingsCollection = client.db('homeyDB').collection('bookings')

        app.get('/favicon.ico', (req, res) => {
            res.status(204).end();
        });

        app.post('/adduser', async (req, res) => {
            try {
                const newUser = req.body;
                const { email } = newUser;
                const existingUser = await usersCollection.findOne({ email: email });
                if (!existingUser) {
                    const result = await usersCollection.insertOne(newUser);
                    res.send(result);
                }
            } catch {
                res.send({ message: 'Internal Server Error' });
            }
        });

        app.get('/users/:email', async (req, res) => {
            try {
                const userEmail = req.params.email;
                const user = await usersCollection.findOne({ email: userEmail });
                console.log(user)

                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }

                return res.status(200).json(user);
            } catch (error) {
                console.error('Error retrieving user:', error);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        app.post('/addservice', async (req, res) => {
            const newService = req.body;
            try {
                const result = await servicesCollection.insertOne(newService);
                res.send(result);
            } catch {
                res.send({ error: 'An error occured' })
            }
        });

        app.patch('/updateservice/:id', async (req, res) => {
            const serviceId = req.params.id;
            const updatedServiceData = req.body;

            try {
                const result = await servicesCollection.updateOne(
                    { _id: new ObjectId(serviceId) },
                    { $set: updatedServiceData }
                );

                if (result.matchedCount > 0) {
                    res.send({ updatedCount: result.modifiedCount });
                } else {
                    res.status(404).send({ error: 'Service not found' });
                }
            } catch (error) {
                console.error('Error updating service:', error);
                res.status(500).send({ error: 'An error occurred' });
            }
        });


        app.get('/services', async (req, res) => {
            try {
                const { query } = req.query;
                let cursor;
                if (query) {
                    cursor = await servicesCollection.find({ serviceName: { $regex: new RegExp(query, 'i') } }).toArray();
                } else {
                    cursor = await servicesCollection.find().toArray();
                }
                res.send(cursor);
            } catch (error) {
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        app.get('/featuredservices', async (req, res) => {
            try {
                const featuredServices = await servicesCollection.find().limit(3).toArray();
                res.send(featuredServices);
            } catch (error) {
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        app.get('/myservices/:email', async (req, res) => {
            const email = req.params.email;
            try {
                const cursor = servicesCollection.find({ email: email });
                const result = await cursor.toArray();
                res.send(result);
            } catch (error) {
                res.send({ error: 'Internal Server Error' });
            }
        });

        app.get('/services/:id', async (req, res) => {
            const id = new ObjectId(req.params.id);
            try {
                const service = await servicesCollection.findOne({ _id: id });
                if (!service) {
                    return res.status(404).json({ error: 'Service not found' });
                }
                const userEmail = service.email;
                const provider = await usersCollection.findOne({ email: userEmail });
                if (!provider) {
                    return res.status(404).json({ error: 'User not found' });
                }
                res.json({ service, provider });
            } catch (error) {
                console.error('Error retrieving service and user data:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        app.post('/addbookings', async (req, res) => {
            const newBooking = req.body;
            try {
                const result = await bookingsCollection.insertOne(newBooking);
                res.status(201).json({ message: 'Booking confirmed successfully' });
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: 'An error occurred while processing the booking' });
            }
        });

        app.patch('/updateStatus/:id', async (req, res) => {
            const bookingId = req.params.id;
            const { newStatus } = req.body;

            try {
                const result = await bookingsCollection.updateOne(
                    { _id: new ObjectId(bookingId) },
                    { $set: { status: newStatus } }
                );

                if (result.matchedCount > 0) {
                    res.json({ message: 'Status updated successfully' });
                } else {
                    res.status(404).json({ error: 'Booking not found' });
                }
            } catch (error) {
                console.error('Error updating status:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        app.get('/myschedules/:email', async (req, res) => {
            const email = req.params.email;
            try {
                const bookings = await bookingsCollection.find({ userEmail: email }).toArray();
                const myWork = await bookingsCollection.find({
                    providerEmail: email
                }).toArray();
                res.json({ bookings, myWork });
            } catch (error) {
                console.error('Error retrieving bookings and services:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        //Delete service
        app.delete('/deleteservice/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const deletedService = await servicesCollection.deleteOne({ _id: new ObjectId(id) });

                if (deletedService.deletedCount === 1) {
                    res.send({ message: 'Service deleted successfully' });
                } else {
                    res.status(404).send({ message: 'Service not found' });
                }
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: 'Internal Server Error' });
            }
        });


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('server is running')
})

app.listen(port, () => {
    console.log(`Server is on port: ${port}`)
})