import axios from "axios";

export async function consultarDadosBasicos(processos: string) {
  try {
    // #TODO
    const res = await axios.post(
      "http://localhost:3100/processos/dados-basicos",
      { numeroProcesso: processos},
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return res.data;
  } catch (err: any) {
    throw new Error(err.response?.data || err.message);
  }
}
export async function consultarProcesso(processoId: string) {
  try {
    // #TODO
    const res = await axios.post(
      "http://localhost:3100/processos/consulta",
      { processoId },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return res.data;
  } catch (err: any) {
    throw new Error(err.response?.data || err.message);
  }
}
