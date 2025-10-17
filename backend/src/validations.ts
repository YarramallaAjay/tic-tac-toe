import { z } from "zod";

const gameStartSchema=z.object({
    name:z.string()
})

export  default gameStartSchema

