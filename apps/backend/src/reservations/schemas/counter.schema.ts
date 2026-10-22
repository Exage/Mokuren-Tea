import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'

// Single-row counter used to generate reservation numbers atomically.
// findOneAndUpdate with $inc is atomic in MongoDB, so concurrent creation
// never produces duplicate numbers without countDocuments() + 1.
@Schema({ collection: 'counters', timestamps: false })
export class Counter {
  @Prop({ type: String, required: true })
  _id!: string

  @Prop({ required: true, default: 0, min: 0 })
  seq!: number
}

export const CounterSchema = SchemaFactory.createForClass(Counter)
