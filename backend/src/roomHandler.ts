import { PrismaClient } from "../prisma/generated/prisma/client.js";
import { createServer } from "http";
import { Server } from "socket.io";

const roomHandler=createServer();

const prisma =new PrismaClient()

const io=new Server(roomHandler,{

})

io.on('connection',(socket)=>{
    console.log('connected to the socket...')
    socket.emit("start",socket.id)

    io.on("start",(socket)=>{
        console.log("Game Started...")

        socket.emit("start","started")
    })

    io.on("move",(socket)=>{
        console.log(`user moved...`)
        updateDB(socket.data)
    })

})

roomHandler.listen(3200)

async function updateDB(data: {
    move:string,
    gameId:string
}){

    const res=await prisma.game.update({
        data:{
            move:data.move
        },
        where:{
            id:data.gameId
        }
    })

    if(res!=null){
        console.log("updated Successfully")
        console.log(res)
    }


}
