const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
require("dotenv").config();
const app = express();
app.use(express.json());
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "http://localhost:5174",
            "https://the-morning-posts.surge.sh",
        ],
        credentials: true,
    })
);

app.use(cookieParser());
console.log(process.env.DB_USER);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pahimj1.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

const verifyToken = (req, res, next) => {
    const token = req.cookies.token;
    console.log(token);

    if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log(err);
            return res.status(401).send({ message: "unauthorized access" });
        }
        req.user = decoded;
        console.log(req.user);
        next();
    });
};

async function run() {
    try {
        // Database Collection
        const NewsCollection = client.db("NewsDb").collection("AllNews");
        const UserCollection = client.db("NewsDb").collection("Users");
        const BookmarksCollection = client.db("NewsDb").collection("booksmarks");

        // Use Post Method

        // JsonWebToken
        app.post("/jwt", async(req, res) => {
            const user = req.body;
            // console.log('user token');
            const token = jwt.sign(user, process.env.NEWS_ACCESS_TOKEN, {
                expiresIn: "1d",
            });
            // console.log('user for token', token,user);

            res
                .cookie("token", token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: "none",
                })
                .send({ success: true });
        });

        // Logout user 

        app.post("/logout", async(req, res) => {
            const user = req.body;
            // console.log("logging out", user);
            res.clearCookie("token", { maxAge: 0 }).send({ success: true });
        });

        //   Create News Section
        app.post("/News", async(req, res) => {
            const News = req.body;
            console.log("News ", News);
            const result = await NewsCollection.insertOne(News);
            // console.log(News);

            res.send(result);
        });
        //   Create User Section
        app.post("/users", async(req, res) => {
            const User = req.body;
            console.log("auth user", User);
            const query = { email: User.email };
            const Exitinguser = await UserCollection.findOne(query);
            if (Exitinguser) {
                // console.log("user ase");
                return res.send({ message: "user already exist", insertedId: null });
            }
            const result = await UserCollection.insertOne(User);

            return res.send(result);
        });

        // Use Get Method

        app.get("/News/:section?", async(req, res) => {
            if (req.params.section) {
                // Dynamic route when req.params.section is truthy
                const query = {
                    section: req.params.section,
                };
                const result = await NewsCollection.find(query).toArray();

                // console.log(",", result);
                res.send(result);
            } else {
                // Fallback route when req.params.section is falsy
                const result = await NewsCollection.find().toArray();
                res.send(result);
            }
        });


        // Use Delete Method

        app.delete("/AllNews/:id", async(req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await NewsCollection.deleteOne(query);
            res.send(result);
        });
        app.post('/bookmarks', async(req, res) => {
            const newsinfo = req.body;
            // console.log(newsinfo)
            const result = await BookmarksCollection.insertOne(newsinfo);
            res.send(result)
        });
        app.get('/singlenews/:id', async(req, res) => {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                // console.log(id)
                const result = await NewsCollection.findOne(query);
                // console.log(result);
                res.send(result)
            })
            // Connect the client to the server	(optional starting in v4.7)
            // await client.connect();
            // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log(
            "Pinged your deployment. You successfully connected to MongoDB!"
        );
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("The Morning Server Is Running");
});
app.listen(port, () => {
    console.log(`Server is Running On ${port}`);
});