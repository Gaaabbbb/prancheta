import { pick, rand } from '../rng';

export const FIRST =
  'Gabriel,Lucas,Matheus,Pedro,Guilherme,Rafael,Gustavo,Felipe,Bruno,Leonardo,Thiago,Vinícius,Rodrigo,Diego,Eduardo,André,Marcelo,Ricardo,Fernando,Daniel,Caio,Igor,Henrique,João,José,Luiz,Paulo,Victor,Vitor,Wesley,Wellington,Willian,Anderson,Alisson,Alex,Alan,Arthur,Breno,Carlos,Cauã,Cristian,Danilo,Douglas,Davi,Emerson,Enzo,Erick,Everton,Fabrício,Fábio,Gilberto,Hugo,Iago,Ítalo,Jean,Jefferson,Jhonatan,Jonas,Júlio,Kaio,Kauã,Kevin,Léo,Lorran,Luan,Marcos,Maicon,Marlon,Maurício,Miguel,Murilo,Nathan,Nicolas,Otávio,Patrick,Raul,Renan,Renato,Robson,Rômulo,Ruan,Samuel,Sérgio,Thalles,Tiago,Ueslei,Vagner,Yago,Yuri,Ygor,Juan,Kelvin,Riquelme,Ryan,Pietro,Heitor,Lorenzo,Bernardo,Isaac,Joaquim,Benício,Emanuel,Elias,Cleiton,Edson,Rogério,Juninho,Valdir,Denilson,Adriano,Ronaldo,Jorge,Michel,Mateus,Natan,Rian,Weverton,Jadson,Kayque,Deivid,Tailson'.split(
    ',',
  );
export const LAST =
  'Silva,Santos,Oliveira,Souza,Lima,Pereira,Ferreira,Costa,Rodrigues,Almeida,Nascimento,Alves,Carvalho,Araújo,Ribeiro,Gomes,Martins,Rocha,Barbosa,Melo,Barros,Freitas,Cardoso,Teixeira,Moreira,Correia,Dias,Moraes,Mendes,Nunes,Castro,Ramos,Pinto,Vieira,Monteiro,Cavalcanti,Batista,Campos,Fernandes,Machado,Soares,Lopes,Farias,Azevedo,Cunha,Brito,Miranda,Andrade,Sales,Rezende,Borges,Pacheco,Fonseca,Tavares,Queiroz,Siqueira,Bezerra,Xavier,Prado,Leite,Amaral,Coelho,Neves,Paiva,Viana,Bastos,Guimarães,Sampaio,Duarte,Macedo,Aguiar,Matos,Assis,Nogueira,Peixoto,Valente,Brandão,Toledo,Rangel,Quintana,Arruda,Bittencourt,Mota,Fontes,Pimentel,Bueno,Godoy,Lacerda,Marinho,Medeiros'.split(
    ',',
  );
export const NICK =
  'Juninho,Dudu,Léo,Kaká,Pedrinho,Netinho,Zé Roberto,Bruninho,Jorginho,Paulinho,Marquinhos,Thiaguinho,Rafinha,Fabinho,Luizão,Tchê,Gabigol,Vavá,Biro,Tuta,Dodô,Neto,Nenê,Baiano,Gaúcho,Cearense,Paraíba,Mineiro,Carioca,Pará,Tinga,Didi,Careca,Pelezinho,Toró,Formiga,Gil,Índio,Tico,Zinho,Bebeto,Diguinho,Robinho,Ronaldinho,Ganso,Coutinho,Bolívar,Sorriso,Magrão,Gordo,Branco,Moita,Batata,Pipico,Quirino,Xuxa,Popó,Kuki,Badhuga,Caju'.split(
    ',',
  );

/** Gera um nome brasileiro; `used` evita repetidos no mesmo elenco. */
export const genName = (used?: Set<string>): string => {
  for (let tries = 0; tries < 20; tries++) {
    let n: string;
    const r = rand();
    if (r < 0.62) n = pick(FIRST) + ' ' + pick(LAST);
    else if (r < 0.82) n = pick(NICK);
    else if (r < 0.92) n = pick(NICK) + ' ' + pick(LAST);
    else n = pick(FIRST);
    if (!used || !used.has(n)) {
      if (used) used.add(n);
      return n;
    }
  }
  return pick(FIRST) + ' ' + pick(LAST) + ' ' + pick(LAST);
};
