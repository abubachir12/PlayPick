require("dotenv").config();

async function main() {
    const apiKey = process.env.RAWG_API_KEY;

    if (!apiKey) {
        throw new Error("Не найден RAWG_API_KEY в файле .env");
    }

    const url = new URL("https://api.rawg.io/api/games");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("search", "Elden Ring");
    url.searchParams.set("page_size", "5");

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`RAWG вернул ошибку: ${response.status}`);
    }

    const data = await response.json();

    if (data.results.length === 0) {
        console.log("Игры не найдены");
        return;
    }

    for (const game of data.results) {
        console.log("\n--------------------");
        console.log("Название:", game.name);
        console.log("Дата выхода:", game.released);
        console.log("Рейтинг:", game.rating);
        console.log("Жанры:", game.genres.map(g => g.name).join(", "));
        console.log("Обложка:", game.background_image);
    }
}

main().catch(error => console.error(error.message));