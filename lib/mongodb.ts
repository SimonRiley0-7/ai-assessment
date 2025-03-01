import mongoose from "mongoose";

const connectToDB = async (): Promise<void> => {
    if (mongoose.connections[0].readyState) return;
    await mongoose.connect(process.env.MONGODB_URI as string, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    } as mongoose.ConnectOptions);
    console.log("MongoDB connected");   
};
export default connectToDB;