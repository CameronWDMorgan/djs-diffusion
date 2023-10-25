const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, AttachmentBuilder } = require('discord.js')
const axios = require('axios')
const config = require('./config.json')
const fs = require('fs')

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
    ],
})

const commands = [
    {
        name: 'generate',
        description: 'Generate image using the API!',
        options: [
            {
                name: 'prompt',
                type: 3,
                description: 'The main prompt for the image',
                required: true,
            },
            {
                name: 'negativeprompt',
                type: 3,
                description: 'The negative prompt for the image',
                required: false,
            },
            {
                name: 'width',
                type: 4,
                description: 'Width of the image',
                required: false,
                choices: [
                    { name: '512 pixels', value: 512 },
                    { name: '768 pixels', value: 768 },
                ],
            },
            {
                name: 'height',
                type: 4,
                description: 'Height of the image',
                required: false,
                choices: [
                    { name: '512 pixels', value: 512 },
                    { name: '768 pixels', value: 768 },
                ],
            },
            {
                name: 'steps',
                type: 4,
                description: 'Number of steps',
                required: false,
                choices: [
                    { name: '20 steps', value: 20 },
                    { name: '50 steps', value: 50 },
                ],
            },
        ],
    },
]

const registerCommands = async () => {
    const commandData = await client.guilds.cache.get('1085014237052682281').commands.set(commands)
    console.log('Successfully registered application commands.')
}

client.once('ready', async () => {
    console.log('Bot is online!')
    await registerCommands()
})

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return

    const { commandName } = interaction

    if (commandName === 'generate') {
        const width = interaction.options.getInteger('width') || 512
        const height = interaction.options.getInteger('height') || 512
        const steps = interaction.options.getInteger('steps') || 20
        const prompt = interaction.options.getString('prompt')
        const negativeprompt = interaction.options.getString('negativeprompt') || config.negativeprompt

        try {
            const response = await axios.post('https://neversfw.ngrok.dev/generate', {
                width,
                height,
                steps,
                prompt,
                negativeprompt,
            })
        
            const { request_id } = response.data
        
            // Initial Reply with an Embed
            let embed = new EmbedBuilder()
                .setTitle('Image Generation')
                .setDescription('Processing your request...')
                .setColor('#3498db')
            const message = await interaction.reply({ embeds: [embed], fetchReply: true })
        
            // Poll for the result
            const pollingInterval = setInterval(async () => {
                try {
                    const positionResponse = await axios.get(`https://neversfw.ngrok.dev/queue_position/${request_id}`)
                    const { status, position } = positionResponse.data
        
                    if (status === 'waiting') {
                        embed.setDescription(`Your request is currently at position ${position} in the queue.`)
                        await message.edit({ embeds: [embed] })
                    } else if (status === 'completed') {
                        clearInterval(pollingInterval)
        
                        const resultResponse = await axios.get(`https://neversfw.ngrok.dev/result/${request_id}`, {
                            responseType: 'arraybuffer'
                        })
        
                        if (resultResponse.data.status === 'processing') {
                            embed.setDescription('Image is still processing. Please wait a moment...')
                            await interaction.editReply({ embeds: [embed] })
                        } else {
                            const imageBuffer = Buffer.isBuffer(resultResponse.data) 
                                ? resultResponse.data 
                                : Buffer.from(resultResponse.data, 'binary')
                            fs.writeFileSync('test_image.png', imageBuffer)

                            footerString = `Prompt: ${prompt} Steps: ${steps} `
                        
                            embed.setImage('attachment://generated_image.png')
                                .setTitle(interaction.guild.name)
                                .setTitle(interaction.guild.name)
                                .setURL("https://discord.gg/2QXV66RVMG")
                                .setDescription('Here is your generated image!')
                                .setFooter({text: footerString})
                                .setTimestamp()

                            console.log(`\nImage Sent to ${interaction.member.displayName}! '${prompt}' \nSteps: ${steps} | Width: ${width} | Height ${height}`)
                        
                            await interaction.editReply({ 
                                embeds: [embed],
                                files: [{
                                    attachment: imageBuffer,
                                    name: 'generated_image.png'
                                }]
                            })
                        }
                    }
        
                } catch (error) {
                    console.error('Error polling the API', error)
                    clearInterval(pollingInterval)
                    embed.setDescription('There was an error polling the API. Please try again later.')
                        .setColor('#e74c3c')
                    await message.edit({ embeds: [embed] })
                }
            }, 1000)  // Poll every second
        
        } catch (error) {
            console.error('Error accessing the API', error)
            await interaction.reply('There was an error accessing the API. Please try again later.')
        }
    }
})

if(config.token.length > 2){
    client.login(config.token)
} else {
    let token = require('./token.json')
    client.login(token.token)
}
