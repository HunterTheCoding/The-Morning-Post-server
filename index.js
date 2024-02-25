const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
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

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.NEWS_ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Database Collection
    const NewsCollection = client.db("NewsDb").collection("AllNews");
    const JobsCollection = client.db("NewsDb").collection("AllJobs");
    const UserCollection = client.db("NewsDb").collection("Users");
    const BookmarksCollection = client.db("NewsDb").collection("BookMark");
    const PullCollection = client.db("NewsDb").collection("Survey-Pull");
    const BannarCollection = client.db("NewsDb").collection("bannar");
    const DonationRequestCollection = client
      .db("NewsDb")
      .collection("Donation");
    const LiveLink = client.db("NewsDb").collection("LiveLink");

    // Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.user?.email;
      const query = { Email: email };
      const user = await UserCollection.findOne(query);
      const IsAdmin = user.role === "admin";
      if (!IsAdmin) {
        return res.status(401).send({ message: "unauthorized User" });
      } else {
        next();
      }
    };

    // JsonWebToken
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.NEWS_ACCESS_TOKEN, {
        expiresIn: "1d",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    // Logout user

    app.post("/logout", async (req, res) => {
      const user = req.body;
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    app.post("/bookmarks", async (req, res) => {
      const newsinfo = req.body;
      const result = await BookmarksCollection.insertOne(newsinfo);
      res.send(result);
    });
    //   Create News Section
    app.post("/News", async (req, res) => {
      const News = req.body;
      const result = await NewsCollection.insertOne(News);
      res.send(result);
    });
    app.post("/bookmarks", async (req, res) => {
      const newsinfo = req.body;
      // console.log(result);
      const result = await BookmarksCollection.insertOne(newsinfo);
      res.send(result);
    });

    // get bookemark data
    app.get("/Bookmark/:email", verifyToken, async (req, res) => {
      const userEmail = req?.user?.email;
      const reqEmail = req?.params?.email;
      // Ensure the requested email matches the user's email
      try {
        // Find all bookmarks for the user
        const query = {
          useremail: reqEmail,
        };
        const userBookmarks = await BookmarksCollection.find(query).toArray();
        // Extract news IDs from bookmarks
        const newsIds = userBookmarks.map(
          (bookmark) => new ObjectId(bookmark.newsid)
        );

        // Retrieve news data for the bookmarked news IDs
        const newsQuery = { _id: { $in: newsIds } };
        const bookmarkedNews = await NewsCollection.find(newsQuery).toArray();
        res.send(bookmarkedNews);
      } catch (error) {
        console.error("Error retrieving bookmarked news:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });
    //   Create User Section
    app.post("/users", async (req, res) => {
      const User = req.body;
      const query = { Email: User?.Email };
      const Exitinguser = await UserCollection.findOne(query);

      if (Exitinguser) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await UserCollection.insertOne(User);
      return res.send(result);
    });

    // create donation
    app.post("/donation-request", verifyToken, async (req, res) => {
      const DonationRequest = req.body;
      const result = await DonationRequestCollection.insertOne(DonationRequest);
      return res.send(result);
    });

    // implement script payment

    app.post("/create-payment-intent", async (req, res) => {
      const { amount } = req.body;
      const amountInCents = parseInt(amount);
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //  create job
    app.post("/api/v1/jobs", async (req, res) => {
      try {
        const body = req.body;
        const result = await JobsCollection.insertOne(body);
        res.send(result);
      } catch (error) {
        res.status(500).send("Internal server error from post api job");
      }
    });

    // Create Poll Request
    // Route to create a new poll
    app.post("/Polls", async (req, res, next) => {
      try {
        const { body } = req;
        if (!body) {
          return res.status(400).json({ message: "Invalid body" });
        }

        // Prepare new poll object with default values
        const newPoll = {
          ...body,
          options: body.options.map((option) => ({
            ...option,
            _id: new ObjectId(),
            votes: [],
          })),
        };

        // Insert the new poll into the database
        const createdPoll = await PullCollection.insertOne(newPoll);
        res.send(createdPoll);
      } catch (error) {
        // Pass any errors to the error handling middleware
        next(error);
      }
    });

    // Banner Section
    app.get("/bannar", async (req, res) => {
      const result = await BannarCollection.find().toArray();
      res.send(result);
    });


    // donation details show
    app.get("/donation/:email", verifyToken, async (req, res) => {
      const reqemail = req.params.email;
      const useremail = req.user.email;
      if (reqemail === useremail) {
        try {
          // Query MongoDB collection
          const query = { "newDonation.email": reqemail };
          const result = await DonationRequestCollection.find(query).toArray(); // Invoke toArray as a method
          res.send(result);
        } catch (error) {
          res.status(500).send("Internal Server Error");
        }
      } else {
        res.status(403).send("Forbidden"); // User is not authorized to access this email
      }
    });
    //  admin has access all donation list
    app.get("/Donation", verifyToken, verifyAdmin, async (req, res) => {
      const result = await DonationRequestCollection.find().toArray();
      res.send(result);
    });
    //  news

    app.get("/News/:section?", async (req, res) => {
      if (req.params.section) {
        // Dynamic route when req.params.section is truthy
        const query = {
          section: req.params.section,
        };
        const result = await NewsCollection.find(query).toArray();
        res.send(result);
      } else {
        // Fallback route when req.params.section is falsy
        const result = await NewsCollection.find().toArray();
        res.send(result);
      }
    });

    // single News load
    app.get("/singleNews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await NewsCollection.findOne(query);
      res.send(result);
    });

    //  get  All Pull request
    app.get("/Show-Pull", verifyToken, async (req, res) => {
      const AllPUll = await PullCollection.find().toArray();
      res.send(AllPUll);
    });

    //  load all jobs

    app.get("/api/v1/jobs", async (req, res) => {
      // Fallback route when req.params.section is falsy
      const result = await JobsCollection.find().toArray();
      res.send(result);
    });
    app.get("/api/v1/job/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await JobsCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error from get api job:", error);
        res.status(500).send("Internal server error");
      }
    });

    app.delete("/api/v1/jobs/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await JobsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error from delete api job:", error);
        res.status(500).send("Internal server error from delete api job");
      }
    });
    app.patch("/api/v1/jobs/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const modifiedData = req.body;
        const updatedDoc = {
          $set: {
            headline: modifiedData.headline,
            image: modifiedData.img,
            summary: modifiedData.summry,
            date: modifiedData.date,
            section: modifiedData.section,
            jobUrl: modifiedData.jobsurl,
          },
        };
        const result = await JobsCollection.updateOne(
          filter,
          updatedDoc,
          options
        );
        res.send(result);
      } catch (error) {
        console.error("Error from patch api job:", error);
        res.status(500).send("Internal server error from patch api job");
      }
    });


    // Check Admin

    app.get("/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      // console.log(req?.user, "email", email);
      if (email !== req?.user?.email) {
        return res.status(403).send({ message: "unauthorized Access" });
      }
      const query = { Email: email };
      const user = await UserCollection.findOne(query);

      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.send({ isAdmin });
    });

    // show all user
    app.get("/Users", verifyToken, verifyAdmin, async (req, res) => {
      console.log("cheack to token", req?.user?.email);
      const result = await UserCollection.find().toArray();
      res.send(result);
    });

    // Route to get a poll by ID
    app.get("/polls/:pollId", verifyToken, async (req, res, next) => {
      try {
        const { pollId } = req.params;
        // Find the poll in the database by ID
        const foundPoll = await PullCollection.findOne({
          _id: new ObjectId(pollId),
        });
        // If the poll is found, send it in the response
        if (foundPoll) {
          return res.status(200).json(foundPoll);
        }
        // If the poll is not found, return a 404 status
        res.status(404).json({ message: "Poll not found" });
      } catch (error) {
        // Pass any errors to the error handling middleware
        next(error);
      }
    });

    //  All section Update Method

    // Bookmark Update
    app.put("/News/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updateNews = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const Donation = {
        $set: {
          section: updateNews?.section,
          headline: updateNews?.headline,
          source: updateNews?.source,
          Upazila: updateNews?.Upazila,
          date: updateNews?.date,
          title: updateNews?.title,
          writer: updateNews?.writer,
          hospital_name: updateNews?.hospital_name,
          image: updateNews?.image,
          summary: updateNews?.summary,
          news: updateNews?.news,
        },
      };

      const result = await DonationRequestCollection.updateOne(
        filter,
        Donation,
        options
      );
      res.send(result);
    });


    // Route to update poll votes
    app.patch("/updatePoll/:pollId", async (req, res, next) => {
      try {
        const { pollId } = req.params;
        const { userId, options } = req.body;
        const poll = await PullCollection.findOne({
          _id: new ObjectId(pollId),
        });

        const updatedOptions = poll.options.map((option) => {
          if (option._id.toString() === options) {
            if (!option.votes.includes(userId)) {
              option.votes.push(userId);
            }
          } else {
            option.votes = option.votes.filter((vote) => vote !== userId);
          }
          return option;
        });
        const result = await PullCollection.updateOne(
          { _id: new ObjectId(pollId) },
          { $set: { options: updatedOptions } }
        );
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    });

    // Use Delete Method
    // admin delete news
    app.delete("/AllNews/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await NewsCollection.deleteOne(query);
      res.send(result);
    });
    // user delete donation
    app.delete("/Donation/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await DonationRequestCollection.deleteOne(query);
      res.send(result);
    });
    //booksmarks delete function--------->
    app.delete("/bookmarks/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        newsid: id,
      };
      const Deletebookmarks = await BookmarksCollection.deleteOne(query);
      res.send(Deletebookmarks);
    });
    app.delete("/Jobs/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await NewsCollection.deleteOne(query);
      res.send(result);
    });
    app.get("/singlenews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await NewsCollection.findOne(query);
      res.send(result);
    });


    // live Client Link set
    app.get("/live", verifyToken, async (req, res) => {
      const live = await LiveLink.find().toArray();
      res.send(live);
    });
    app.put("/live", async (req, res) => {
      try {
        const body = req.body;
        const filter = { Find: body?.Find };
        const options = { upsert: true };
        const Link = {
          $set: {
            Link: body?.Link,
            Find: body?.Find,
          },
        };
        const result = await LiveLink.updateOne(filter,Link,options)
        res.send(result);
      } catch (error) {
        res.status(500).send("Internal server error from post api job");
      }
    });


    await client.connect();

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {

  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("The Morning Server Is Running");
});
app.listen(port, () => {
  console.log(`Server is Running On ${port}`);
});
