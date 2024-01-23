import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    sold: {
      type: Boolean,
      default: false,
    },
    dateOfSale: {
      type: Date,
      index: true,
    },
  },
  { timestamps: true }
);
productSchema.index({ dateOfSale: 1 });
export default mongoose.model("Product", productSchema);
