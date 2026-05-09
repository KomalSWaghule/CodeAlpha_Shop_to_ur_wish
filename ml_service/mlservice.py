from pymongo import MongoClient
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity
from bson import ObjectId
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")


client = MongoClient(MONGODB_URI)

db = client["ecommerce"]

product_collection = db["products"]
orders_collection = db["orders"]
similarity_collection = db["product_similarity"]

print("Fetching orders...")

orders = list(orders_collection.find())

products = {
    p["_id"]: p for p in product_collection.find()
}

data = []

# Build user-product interaction matrix
for order in orders:

    user_id = str(order["userId"])

    for item in order["products"]:

        try:
            product_id = ObjectId(item["product"])

            data.append([
                user_id,
                product_id,
                1
            ])

        except Exception as e:
            print("Invalid product ID:", e)

# Create dataframe
df = pd.DataFrame(
    data,
    columns=["userId", "productId", "value"]
)

print("Building pivot table...")

pivot = df.pivot_table(
    index="userId",
    columns="productId",
    values="value",
    fill_value=0
)

print("Converting to sparse matrix...")

# Collaborative filtering similarity
if pivot.shape[0] > 0 and pivot.shape[1] > 0:

    sparse_matrix = csr_matrix(pivot.values)

    product_similarity = cosine_similarity(
        sparse_matrix.T
    )

    product_ids = pivot.columns.tolist()

else:

    product_similarity = None
    product_ids = []

print("Clearing old similarity data...")

similarity_collection.delete_many({})

print("Loading AI model...")

model = SentenceTransformer(
    'all-MiniLM-L6-v2'
)

print("Preparing product texts...")

product_texts = {}
product_ids_list = []

for pid, product in products.items():

    text = (
        str(product.get("name", "")) + " " +
        str(product.get("category", "")) + " " +
        str(product.get("description", ""))
    )

    product_texts[pid] = text

    product_ids_list.append(pid)

print("Generating embeddings...")

embeddings = model.encode(
    list(product_texts.values()),
    batch_size=32,
    show_progress_bar=True
)

print("Computing semantic similarity...")

semantic_similarity = cosine_similarity(
    embeddings
)

semantic_index_map = {
    pid: idx for idx, pid in enumerate(product_ids_list)
}

product_index_map = {
    pid: idx for idx, pid in enumerate(product_ids)
}

print("Building recommendations...")

for product_id, base_product in products.items():

    category = base_product.get("category")

    price = base_product.get("price", 0)

    min_price = price * 0.8
    max_price = price * 1.2

    filteredproduct = []

    for sim_product_id, sim_product in products.items():

        if not sim_product:
            continue

        if sim_product_id == product_id:
            continue

        sim_price = sim_product.get("price", 0)

        semantic_score = 0
        collab_score = 0

        # Semantic similarity
        if (
            product_id in semantic_index_map and
            sim_product_id in semantic_index_map
        ):

            i_sem = semantic_index_map[product_id]
            j_sem = semantic_index_map[sim_product_id]

            semantic_score = semantic_similarity[i_sem][j_sem]

        # Collaborative filtering similarity
        if (
            product_similarity is not None and
            product_id in product_index_map and
            sim_product_id in product_index_map
        ):

            i = product_index_map[product_id]
            j = product_index_map[sim_product_id]

            collab_score = product_similarity[i][j]

        # Bonus score
        bonus = 0

        if sim_product.get("category") == category:
            bonus += 0.1

        if min_price <= sim_price <= max_price:
            bonus += 0.1

        # Recommendation threshold
        if (
            collab_score > 0.2 or
            semantic_score > 0.5
        ):

            final_score = (
                (0.6 * collab_score) +
                (0.4 * semantic_score) +
                bonus
            )

            filteredproduct.append(
                (sim_product_id, final_score)
            )

    # Sort products by score
    filteredproduct = sorted(
        filteredproduct,
        key=lambda x: x[1],
        reverse=True
    )

    # Keep top 10
    filteredproduct = [
        pid for pid, _ in filteredproduct[:10]
    ]

    # Store in MongoDB
    similarity_collection.insert_one({
        "productId": product_id,
        "similarProducts": filteredproduct
    })

print("DF shape:", df.shape)

if not df.empty:
    print(df.head())

print("Pivot shape:", pivot.shape)

if not pivot.empty:
    print(pivot.head())

print("Done building similarity!")