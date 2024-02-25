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
      // "http://localhost:5174",
      "https://the-morning-posts.surge.sh",
    ],
    credentials: true,
  })
);
console.log(process.env.STRIPE_SECRET);

app.use(cookieParser());
// console.log(process.env.DB_USER);

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
  // console.log(token);

  if (!token) {
    console.log("token nai");
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.NEWS_ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    // console.log(req.user);
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
    const DonationRequestCollection = client
      .db("NewsDb")
      .collection("Donation");
    const LiveLink = client.db("NewsDb").collection("LiveLink");

    // Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.user?.email;
      const query = { Email: email };
      const user = await UserCollection.findOne(query);
      // console.log(email,user);
      const IsAdmin = user.role === "admin";

      if (!IsAdmin) {
        console.log("error");
        return res.status(401).send({ message: "unauthorized User" });
      } else {
        next();
      }
    };

    // Use Post Method

    // JsonWebToken
    app.post("/jwt", async (req, res) => {
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

    app.post("/logout", async (req, res) => {
      const user = req.body;
      // console.log("logging out", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });
    //   Create News Section
    app.post("/News", async (req, res) => {
      const News = req.body;
      //   console.log("News ", News);
      const result = await NewsCollection.insertOne(News);
      // console.log(result);
      // res.send(result);
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
      console.log("auth user", User);
      const query = { Email: User?.Email };
      const Exitinguser = await UserCollection.findOne(query);
      console.log(Exitinguser);
      if (Exitinguser) {
        console.log("user ase");
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await UserCollection.insertOne(User);
      // console.log(result);
      return res.send(result);
    });

    // create donation
    app.post("/donation-request", verifyToken, async (req, res) => {
      const DonationRequest = req.body;
      console.log(DonationRequest);

      const result = await DonationRequestCollection.insertOne(DonationRequest);
      console.log(result);
      return res.send(result);
    });

    // implement script payment

    app.post("/create-payment-intent", async (req, res) => {
      const { amount } = req.body;
      console.log(req.body);
      const amountInCents = parseInt(amount);
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        payment_method_types: ["card"],
      });
      console.log(paymentIntent);

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
        console.error("Error from post api job:", error);
        res.status(500).send("Internal server error from post api job");
      }
    });

    // Create Poll Request
    // Route to create a new poll
    app.post("/Polls", async (req, res, next) => {
      try {
        const { body } = req;

        // Check if request body is valid
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
        console.log(createdPoll, newPoll);
        res.send(createdPoll);
      } catch (error) {
        // Pass any errors to the error handling middleware
        next(error);
      }
    });

    // Use Get Method

    // Banner Section
    
    // app.get("/bannar", async (req, res) => {
    //   const result = await BannarCollection.find().toArray();
    //   res.send(result);
    // });

    // donation details show
    app.get("/donation/:email", verifyToken, async (req, res) => {
      const reqemail = req.params.email;
      const useremail = req.user.email;

      console.log(reqemail, useremail);

      if (reqemail === useremail) {
        console.log(`function is working`);

        try {
          // Query MongoDB collection
          const query = { "newDonation.email": reqemail };
          const result = await DonationRequestCollection.find(query).toArray(); // Invoke toArray as a method

          console.log(result);

          res.send({ result });
        } catch (error) {
          console.error("Error while querying database:", error);
          res.status(500).send("Internal Server Error");
        }
      } else {
        res.status(403).send("Forbidden"); // User is not authorized to access this email
      }
    });
    //  admin has access all donation list
    app.get("/Donation", verifyToken, verifyAdmin, async (req, res) => {
      const result = await DonationRequestCollection.find().toArray();
      // console.log(result);
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

        // console.log(",", result);
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
      // console.log(id)
      const result = await NewsCollection.findOne(query);
      // console.log(result);
      res.send(result);
    });

    //  get  All Pull request
    app.get("/Show-Pull", verifyToken, async (req, res) => {
      const AllPUll = await PullCollection.find().toArray();
      console.log(AllPUll);
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
        console.log(id);
        const query = { _id: new ObjectId(id) };
        console.log("from query", query);
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
      // console.log("asoe hlit hocche", req?.user?.email);
      const email = req.params.email;

      // console.log(req?.user, "emaillllllll", email);
      if (email !== req?.user?.email) {
        return res.status(403).send({ message: "unauthorized Access" });
      }
      const query = { Email: email };
      const user = await UserCollection.findOne(query);

      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      console.log(isAdmin, "admin");
      res.send({ isAdmin });
    });

    // show all user
    app.get("/Users", verifyToken, verifyAdmin, async (req, res) => {
      console.log("cheack to token", req?.user?.email);
      // console.log(req.user);
      const result = await UserCollection.find().toArray();
      // console.log(result);
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
      console.log("id", id);
      console.log("filter", filter);

      console.log(updateNews);

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
      console.log(Donation);

      const result = await DonationRequestCollection.updateOne(
        filter,
        Donation,
        options
      );
      console.log(result);
      res.send(result);
    });

    // Route to update a poll
    // app.patch("/updatePoll/:pollId", async (req, res, next) => {
    //   try {
    //     const { pollId } = req.params;
    //     const { body } = req;
    //     console.log(body);
    //     // Prepare updated poll object with default values
    //     const updatedPoll = {
    //       ...body,
    //       options: body?.options.map((option) => ({
    //         ...option,
    //         _id: option._id ? option._id : new ObjectId(),
    //         votes: option.votes ? option.votes : [],
    //       })),
    //     };
    //     console.log(updatedPoll);
    //     // Update the poll in the database
    //     const updateResult = await PullCollection.updateOne(
    //       { _id: new ObjectId(pollId) },
    //       { $set: updatedPoll },
    //       { upsert: true }
    //     );
    //     res.send(updateResult);
    //   } catch (error) {}
    // });

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

        console.log("update", updatedOptions);
        const result = await PullCollection.updateOne(
          { _id: new ObjectId(pollId) },
          { $set: { options: updatedOptions } }
        );
        console.log("result", result);
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
      console.log(id);
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
      // console.log(id)
      const result = await NewsCollection.findOne(query);
      // console.log(result);
      res.send(result);
    });


    // live Client Link set
    app.get("/live", verifyToken, async (req, res) => {
      const live = await LiveLink.find().toArray();
      res.send(live);
    });
    app.post("/live", async (req, res) => {
      try {
        const body = req.body;
        const result = await LiveLink.insertOne(body);
        res.send(result);
      } catch (error) {
        res.status(500).send("Internal server error from post api job");
      }
    });
    app.delete("/live/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await LiveLink.deleteOne(query);
      res.send(result);
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
