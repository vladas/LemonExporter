function setCookie(c_name, value, exdays)
{
    var exdate = new Date();
    exdate.setDate(exdate.getDate() + exdays);
    var c_value = escape(value) + ((exdays==null) ? "" : "; expires="+exdate.toUTCString());
    document.cookie=c_name + "=" + c_value;
}

function fetchReceipts(currency, month, callback) {
    var req = new XMLHttpRequest();
    req.open(
        "POST",
        "https://dashboard.lemon.com/purchases/process.php",
        false);
        
    req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

    var purchases = [];
    req.onload = function() {
        purchases = JSON.parse(req.responseText).purchases;
    };
    req.send("action=getReceipts&page=1&pageSize=100&label=&month=" + month + "&currency=" + currency);
    
    callback(purchases);
}

function fetchItems(purchases, callback, purchasesWithItems) {
    for (var i=0; i < purchases.length; ++i) {
        purchasesWithItems.push(fetchPurchaseWithItems(purchases[i].id));
    }
}

function fetchPurchaseWithItems(purchaseId) {
    var req = new XMLHttpRequest();
    req.open(
        "POST",
        "http://dashboard.lemon.com/common/processPurchase.php",
        false);
        
    req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

    var result = {};
    req.onload = function() {
        result = JSON.parse(req.responseText).ticket;
    };
    req.send("action=getReceiptDetail&id=" + purchaseId);
    
    return result;
}

function exportPurchasesWithItemsToCSV(data) {
//    console.log(data);
    console.log(JSON.stringify(data));
    var csvSeparator = ";"
    var csvRowDelimiter = "\n"
    var csv = ""
    var entry = {};
    var item = {};
    var props = ["id", "status", "date", "time", "currency_iso3", "image", "store_name", "total", "item_id", "item_quantity", "item_description", "item_total"];
    var i;
    var row = [];
    
    // header
    csv = props.join(csvSeparator);
    
    for (i = 0; i < data.length; ++i) {
        entry = data[i];
        for (var j = 0; j < entry.items.length; ++j) {
            item = entry.items[j];
            
            row = [
                entry.id,
                entry.status,
                entry.date,
                entry.time,
                JSON.stringify(entry.currency_iso3),
                JSON.stringify(entry.image),
                JSON.stringify(entry.store.name),
                entry.total,
                item.id,
                item.quantity,
                JSON.stringify(item.description),
                item.total * ((item.isNegative) ? -1 : 1)
            ];
            
            csv = csv + csvRowDelimiter + row.join(csvSeparator);
        }
        
        for (j = 0; j < entry.discounts.length; ++j) {
            discount = entry.discounts[j];
            
            row = [
                entry.id,
                entry.status,
                entry.date,
                entry.time,
                JSON.stringify(entry.currency_iso3),
                JSON.stringify(entry.image),
                JSON.stringify(entry.store.name),
                entry.total,
                discount.id,
                1,
                JSON.stringify(discount.description),
                discount.total * -1
            ];
            
            csv = csv + csvRowDelimiter + row.join(csvSeparator);
        }
    }
    
    return csv;
}

function fetchReceiptsByCurrenciesAndMonth(currencies, month) {
    var purchasesWithItems = [];
    var currency = undefined;
    for (var i = 0; i < currencies.length; ++i) {
        currency = currencies[i];
        fetchReceipts(currency, month, function(purchases) {
            fetchItems(purchases, exportPurchasesWithItemsToCSV, purchasesWithItems)
        });
    }
    
    return purchasesWithItems;
}

function run() {
    chrome.cookies.getAll({domain: "dashboard.lemon.com"}, function(cookies) {
        for (var i=0; i < cookies.length; ++i) {
           setCookie(cookies[i].name, cookies[i].value, 3); 
        }
    });
    var currencies = document.getElementsByName('currencies')[0].value.split(',');
    var month = document.getElementsByName('month')[0].value;
    
    var purchasesWithItems = fetchReceiptsByCurrenciesAndMonth(currencies, month);
    var csvString = exportPurchasesWithItemsToCSV(purchasesWithItems);
    document.getElementsByName('output')[0].value = csvString;
}