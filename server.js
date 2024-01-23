import express from "express";
import axios from "axios";
import env from "dotenv";
import morgan from "morgan";
import connectDB from "./config/database.js";
import Product from "./model/productModel.js";
import cors from "cors";

//Configure .ENV
env.config();

//Express Object
const app = express();

//Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

//SERVER PORT
const PORT = process.env.PORT || 8080;
const ApiUrl = process.env.API_URL || "http://localhost:9000";

// Array of month names
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

//Function to fetch data based on Month Name
const fetchRecordsForMonth = async (monthNameParam) => {
  try {
    // Connect to the database
    await connectDB();

    // Validate monthNameParam to ensure it is a valid month name
    const isValidMonth = monthNames.includes(monthNameParam);

    if (!isValidMonth) {
      throw new Error("Invalid month name");
    }

    // Get records from the database for the specified month
    const recordsForMonth = await Product.find({
      $expr: {
        $eq: [
          { $month: "$dateOfSale" },
          monthNames.findIndex((name) => name === monthNameParam) + 1,
        ],
      },
    }).lean();

    // Convert dateOfSale format to month name for each record
    const recordsWithMonthNames = recordsForMonth.map((record) => {
      const date = new Date(record.dateOfSale);
      const monthIndex = date.getMonth();
      const monthName = monthNames[monthIndex];

      // Add monthName to the record
      return {
        id: record.id,
        category: record.category,
        price: record.price,
        sold: record.sold,
        dateOfSale: record.dateOfSale,
        monthName: monthName,
      };
    });

    return recordsWithMonthNames;
  } catch (error) {
    throw error;
  }
};

//Rest API-home
app.get("/home", async (req, res) => {
  try {
    await connectDB();

    const existingProducts = await Product.find();

    if (existingProducts && existingProducts.length > 0) {
      res.json(existingProducts);
    } else {
      const response = await axios.get(
        "https://s3.amazonaws.com/roxiler.com/product_transaction.json"
      );

      const products = response.data;

      await Product.insertMany(products);

      res.json(products);
    }
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error: "Internal Server Error",
    });
  }
});

app.post("/search/:monthName", async (req, res) => {
  try {
    await connectDB();

    const monthNameParam = req.params.monthName;

    const isValidMonth = monthNames.includes(monthNameParam);

    if (!isValidMonth) {
      res.status(400).json({ error: "Invalid month name" });
      return;
    }

    const recordsForMonth = await Product.find({
      $expr: {
        $eq: [
          { $month: "$dateOfSale" },
          monthNames.findIndex((name) => name === monthNameParam) + 1,
        ],
      },
    }).lean();

    const { searchValue } = req.body;

    let searchResults;

    if (!searchValue) {
      searchResults = recordsForMonth;
    } else {
      searchResults = await Product.find({
        $and: [
          {
            $expr: {
              $eq: [
                { $month: "$dateOfSale" },
                monthNames.findIndex((name) => name === monthNameParam) + 1,
              ],
            },
          },
          {
            $or: [
              { title: { $regex: new RegExp(searchValue, "i") } },
              { description: { $regex: new RegExp(searchValue, "i") } },
              {
                price: isNaN(searchValue) ? undefined : parseFloat(searchValue),
              },
            ].filter((condition) => condition !== undefined),
          },
        ],
      })
        .select("id title price description category image sold dateOfSale")
        .lean();
    }

    const recordsWithMonthNames = searchResults.map((record) => {
      const date = new Date(record.dateOfSale);
      const monthIndex = date.getMonth();
      const monthName = monthNames[monthIndex];

      return {
        id: record.id,
        title: record.title,
        price: record.price,
        description: record.description,
        category: record.category,
        image: record.image,
        sold: record.sold,
        dateOfSale: record.dateOfSale,
        monthName: monthName,
      };
    });

    res.json(recordsWithMonthNames);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// Rest API-Data
app.get("/data/:monthName", async (req, res) => {
  try {
    const monthNameParam = req.params.monthName;
    const existingProducts = await fetchRecordsForMonth(monthNameParam);

    // Total sale amount for the specified month
    const totalSaleAmount = existingProducts.reduce(
      (total, record) => total + (record.sold ? record.price : 0),
      0
    );

    // Total number of sold items for the specified month
    const totalSoldItems = existingProducts.filter(
      (record) => record.sold
    ).length;

    // Total number of not sold items for the specified month
    const totalNotSoldItems = existingProducts.filter(
      (record) => !record.sold
    ).length;

    res.json({
      records: existingProducts,
      count: existingProducts.length,
      totalSaleAmount,
      totalSoldItems,
      totalNotSoldItems,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// Rest API-Bar Chart
app.get("/bar-chart/:monthName", async (req, res) => {
  try {
    const monthNameParam = req.params.monthName;
    const existingProducts = await fetchRecordsForMonth(monthNameParam);

    const priceRanges = {
      "0-100": 0,
      "101-200": 0,
      "201-300": 0,
      "301-400": 0,
      "401-500": 0,
      "501-600": 0,
      "601-700": 0,
      "701-800": 0,
      "801-900": 0,
      "901-above": 0,
    };

    existingProducts.forEach((record) => {
      const price = record.price;
      if (price <= 100) {
        priceRanges["0-100"]++;
      } else if (price <= 200) {
        priceRanges["101-200"]++;
      } else if (price <= 300) {
        priceRanges["201-300"]++;
      } else if (price <= 400) {
        priceRanges["301-400"]++;
      } else if (price <= 500) {
        priceRanges["401-500"]++;
      } else if (price <= 600) {
        priceRanges["501-600"]++;
      } else if (price <= 700) {
        priceRanges["601-700"]++;
      } else if (price <= 800) {
        priceRanges["701-800"]++;
      } else if (price <= 900) {
        priceRanges["801-900"]++;
      } else {
        priceRanges["901-above"]++;
      }
    });

    res.json({
      records: existingProducts,
      count: existingProducts.length,
      priceRanges,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// Rest API-Pie Chart
app.get("/pie-chart/:monthName", async (req, res) => {
  try {
    const monthNameParam = req.params.monthName;
    const existingProducts = await fetchRecordsForMonth(monthNameParam);

    // Unique categories and their counts
    const categoryCounts = {};
    existingProducts.forEach((record) => {
      const category = record.category;
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    res.json({
      records: existingProducts,
      count: existingProducts.length,
      categoryCounts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// Rest API-Combined-Data
app.get("/statistic/:monthName", async (req, res) => {
  try {
    const monthNameParam = req.params.monthName;

    const isValidMonth = monthNames.includes(monthNameParam);

    if (!isValidMonth) {
      res.status(400).json({ error: "Invalid month name" });
      return;
    }

    const dataResponse = await axios.get(`${ApiUrl}/data/${monthNameParam}`);
    const dataFromApi1 = dataResponse.data;

    const barChartResponse = await axios.get(
      `${ApiUrl}/bar-chart/${monthNameParam}`
    );
    const dataFromApi2 = barChartResponse.data;

    const pieChartResponse = await axios.get(
      `${ApiUrl}/pie-chart/${monthNameParam}`
    );
    const dataFromApi3 = pieChartResponse.data;

    const combinedResponse = {
      data: dataFromApi1.records,
      count: dataFromApi1.count,
      totalSaleAmount: dataFromApi1.totalSaleAmount,
      totalSoldItems: dataFromApi1.totalSoldItems,
      totalNotSoldItems: dataFromApi1.totalNotSoldItems,
      priceRanges: dataFromApi2.priceRanges,
      categoryCounts: dataFromApi3.categoryCounts,
    };

    res.json(combinedResponse);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

//Listen PORT
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
