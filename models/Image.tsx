import mongoose, {Document,Schema} from "mongoose";
interface IImage extends Document {
    imageUrl?: string;
    caption?: string;
    createdAt?: Date;
}
const ImageSchema = new Schema({
    imageUrl: { type: String, required: true },
    caption: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});
const Image = mongoose.model<IImage>("Image", ImageSchema);
export default Image;