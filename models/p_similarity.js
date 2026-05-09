import mongoose from 'mongoose';

const productSimilaritySchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
        unique: true
    },
    similarProducts: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product"
        }
    ]
});

const Similarity = mongoose.model(
    "ProductSimilarity",
    productSimilaritySchema,
    "product_similarity" 
);
export default Similarity;