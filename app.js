document.getElementById('detail-submit-btn').addEventListener('click', function(){
    const buyerDetails = document.getElementById('buyer-details-input');
    const buyerDetailsValue = buyerDetails.value;
    const setBuyerInfo = document.getElementById('buyer-info');
    setBuyerInfo.innerText = buyerDetailsValue;
})

document.getElementById('add-details-btn').addEventListener('click',function(){
    let itemNameInput = document.getElementById('item-name-input');
    let itemPriceInput = document.getElementById('item-price-input');
    let itemQuantityInput = document.getElementById('item-quantity-input');
   let  productPrice = (parseFloat(itemPriceInput.value)* parseFloat(itemQuantityInput.value));

   

  const tr = document.createElement("tr");
  const th = document.createElement('th');
  const td1 = document.createElement('td');
  const td2 = document.createElement('td');
  const td3 = document.createElement('td');
  td3.classList.add('total-price');

 th.innerText = itemNameInput.value;
 td1.innerText = itemPriceInput.value;
 td2.innerText = itemQuantityInput.value;
 td3.innerText = productPrice;

tr.appendChild(th);
tr.appendChild(td1);
tr.appendChild(td2);
tr.appendChild(td3);

const tableValues = document.getElementById('info-table');
 tableValues.appendChild(tr);
 itemNameInput.value = '';
 itemPriceInput.value = '';
 itemQuantityInput.value = '';
 productPrice = '';

 taxCalculation();


})

function subTotal(){
    let subTotal = 0;
    const prices = document.getElementsByClassName('total-price');
    for(let i= 0; i< prices.length; i++){
        const element = prices[i];
        const price = parseInt(element.innerText);
        subTotal = subTotal + price;   
    }
    return subTotal;
}

function taxCalculation (){
    let subTotal1 = subTotal();
    document.getElementById('sub-total').innerText = subTotal1; 
    const tax = subTotal1 * .2;
    document.getElementById('tax').innerText = tax;

    const totalPrice = subTotal1 + tax;
    document.getElementById('grand-total').innerText = totalPrice;
    document.getElementById('grand-total-2').innerText = totalPrice;
}
function printPaper(){
    window.print();
}

function generatePdf(){
   const full =  document.getElementById('full');
   html2pdf()
   .from(full)
   .save();

}