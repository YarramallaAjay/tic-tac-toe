import Express = require("express")
const app=Express()

app.use("/health",async(req, res)=>{
    console.log(process.connected)
    res.json({
        'Health':process.connected
    })

})
app.use("/start",async(req, res)=>{

})

app.use("/join",async(req,res)=>{

})

app.use("/score/:gameId",async(req,res)=>{

})

app.listen(3100,()=>{
    console.log(`server is running in 3100`);
})